import { properties } from "../properties";
import { CandleSeries, toCandleSeries } from "../core/candle-series";
import { m } from "../functions/functions";
import { getCurrentTimestampInSeconds } from "../util";

export const FtxMarkets = [
  "BTC/USD",
  "ETH/USD",
  "FTT/USD",
  "SUSHI/USD",
  "DOGE/USD",
  "LINK/USD",
  "XRP/USD",
] as const;
export type FtxMarket = typeof FtxMarkets[number];

const FtxRest = require("ftx-api-rest");

const { ftx_api_key, ftx_s } = properties;
const subaccount = "bot";

const api = new FtxRest({
  key: ftx_api_key,
  secret: ftx_s.substr(1),
  subaccount,
});

async function request(
  method: "GET" | "POST" | "DELETE",
  path: string,
  data?: any
): Promise<any> {
  console.log(`${method} ftx.com${path}`);
  return api.request({ method, path, data }).then((response) => {
    if (response.success) {
      return response.result;
    } else {
      throw Error("Request to FTX not successful");
    }
  });
}

async function get(path: string): Promise<any> {
  return request("GET", path);
}

async function post(path: string, data: any): Promise<any> {
  return request("POST", path, data);
}

async function getAccount() {
  return get("/account");
}

const resolutionsInSeconds = [15, 60, 300, 900, 3600, 14400, 86400];
const resolutionValues = [
  "15sec",
  "1min",
  "5min",
  "15min",
  "1h",
  "4h",
  "1d",
] as const;
export type FtxResolution = typeof resolutionValues[number];

export interface FtxCandleRequestParams {
  market: FtxMarket;
  resolution: FtxResolution;
  startTime: number;
  endTime: number;
}

async function getCandles(
  params: FtxCandleRequestParams
): Promise<CandleSeries> {
  const resInSecs =
    resolutionsInSeconds[resolutionValues.indexOf(params.resolution)];
  // optional "limit" parameter omitted
  return get(
    `/markets/${params.market}/candles?resolution=${resInSecs}` +
      `&start_time=${params.startTime}&end_time=${params.endTime}&limit=${5000}`
  ).then((candles) =>
    // ftx returns time in milliseconds, which is inconsistent with finnhub
    candles.map((c) => ({ ...c, time: c.time / 1000 }))
  );
}

async function getCandleSeries(params: FtxCandleRequestParams) {
  return toCandleSeries(await getCandles(params));
}

export interface OrderBookEntry {
  price: number;
  /**
   * The amount of bid/ask at this price.
   */
  volume: number;
  /**
   * The cumulative amount of bid/ask up to and including this price.
   */
  cumulative: number;
  /**
   * The relative difference between this price and the best bid/ask price.
   * It's a positive number, also for bids although they're decreasing.
   */
  relDiff: number;
}

export interface OrderBook {
  market: FtxMarket;
  asks: OrderBookEntry[];
  bids: OrderBookEntry[];
  /**
   * The middle point between best bid and ask prices.
   */
  midPrice: number;
  /**
   * The bid-ask spread relative to the best bid price.
   */
  relSpread: number;
  /**
   * Timestamp of the moment when the order book was requested,
   * as seconds since the Unix epoch.
   */
  time: number;
}

export interface FtxOrderBookParams {
  market: FtxMarket;
  /**
   * max 100, default 20
   */
  depth: number;
}

async function getOrderBook(params: FtxOrderBookParams): Promise<OrderBook> {
  const { market, depth } = params;
  const response = await get(`/markets/${market}/orderbook?depth=${depth}`);
  const time = getCurrentTimestampInSeconds();

  const convertEntries = (entry) =>
    entry.reduce((acc, [price, volume]) => {
      const cumulative =
        (acc.length ? acc[acc.length - 1].cumulative : 0) + volume;

      const bestPrice = acc.length ? acc[0].price : price;
      const relDiff = Math.abs((price - bestPrice) / bestPrice);

      const entry: OrderBookEntry = {
        price,
        volume,
        cumulative,
        relDiff,
      };
      acc.push(entry);
      return acc;
    }, []);

  const asks = convertEntries(response.asks);
  const bids = convertEntries(response.bids);

  const midPrice = m.avg([asks[0].price, bids[0].price]);
  const relSpread = (asks[0].price - bids[0].price) / bids[0].price;

  return { market, asks, bids, midPrice, relSpread, time };
}

async function getOpenOrders(
  market: FtxMarket
): Promise<
  {
    id: number;
    market: FtxMarket;
    price: number;
    side: "buy" | "sell";
    size: number;
    filledSize: number;
    type: string;
    postOnly: boolean;
  }[]
> {
  return get(`/orders?market=${market}`);
}

async function cancelOrder(id: number): Promise<string> {
  return request("DELETE", `/orders/${id}`);
}

async function cancelAllOrders(market: FtxMarket): Promise<string> {
  return request("DELETE", `/orders`, { market });
}

interface FtxAddOrderParams {
  market: FtxMarket;
  side: "buy" | "sell";
  price: number;
  type: "market" | "limit";
  size: number;
  postOnly: boolean;
}

async function addOrder(params: FtxAddOrderParams): Promise<{ id: number }> {
  return post("/orders", params);
}

export const ftx = {
  getAccount,
  getCandles,
  getCandleSeries,
  getOrderBook,
  getOpenOrders,
  cancelOrder,
  cancelAllOrders,
  addOrder,
};
