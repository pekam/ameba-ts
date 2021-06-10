import { getFtxSubAccountProperties, properties } from "../properties";
import { m } from "../functions/functions";
import { getCurrentTimestampInSeconds } from "../util";
import { CandleSeries } from "../core/types";

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

export interface FtxAddOrderParams {
  market: FtxMarket;
  side: "buy" | "sell";
  price: number;
  type: "market" | "limit";
  size: number;
  postOnly: boolean;
}

export interface FtxFill {
  price: number;
  size: number;
  side: "buy" | "sell";
  market: FtxMarket;
  fee: number;
  feeCurrency: string;
}

const FtxRest = require("ftx-api-rest");

const { ftx } = properties;

export function getFtxClient({
  subaccount,
}: {
  subaccount: string | undefined;
}) {
  const keys = getFtxSubAccountProperties(subaccount);

  const api = new FtxRest({
    key: keys.api_key,
    secret: keys.s.substr(1),
    subaccount,
  });

  /**
   * @param errorHandler function that is called if error occurs. It should return
   * true if the error should be thrown, false if not.
   */
  async function request(
    method: "GET" | "POST" | "DELETE",
    path: string,
    data?: any,
    errorHandler: (e: Error) => boolean = (e) => true
  ): Promise<any> {
    try {
      console.log(`${method} ftx.com${path}`, data);
      const response = await api.request({ method, path, data });
      return response.result;
    } catch (e) {
      const shouldThrow = errorHandler(e);
      if (shouldThrow) {
        throw e;
      }
    }
  }

  async function get(path: string): Promise<any> {
    return request("GET", path);
  }

  async function post(path: string, data: any): Promise<any> {
    return request("POST", path, data);
  }

  async function getAccount(): Promise<{
    collateral: number;
    freeCollateral: number;
    leverage: number;
    spotMarginEnabled: boolean;
  }> {
    return get("/account");
  }

  async function getBalances(): Promise<
    { coin: string; free: number; total: number; usdValue: number }[]
  > {
    return get("/wallet/balances");
  }

  async function getCandles(
    params: FtxCandleRequestParams
  ): Promise<CandleSeries> {
    const resInSecs =
      resolutionsInSeconds[resolutionValues.indexOf(params.resolution)];
    // optional "limit" parameter omitted
    return get(
      `/markets/${params.market}/candles?resolution=${resInSecs}` +
        `&start_time=${params.startTime}&end_time=${
          params.endTime
        }&limit=${5000}`
    ).then((candles) =>
      // ftx returns time in milliseconds, which is inconsistent with finnhub
      candles.map((c) => ({ ...c, time: c.time / 1000 }))
    );
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

  async function getOrderStatus(
    id: number
  ): Promise<{
    status: "new" | "open" | "closed";
    filledSize: number;
    remainingSize: number;
  }> {
    return get(`/orders/${id}`);
  }

  async function cancelOrder(id: number): Promise<string> {
    const errorHandler = (e) => {
      if (e.message.includes("Order already")) {
        console.log(
          "Order was already closed or queued for cancellation, all good."
        );
        return false;
      } else {
        return true;
      }
    };
    return request("DELETE", `/orders/${id}`, undefined, errorHandler);
  }

  async function cancelAllOrders(market: FtxMarket): Promise<string> {
    return request("DELETE", `/orders`, { market });
  }

  async function addOrder(params: FtxAddOrderParams): Promise<{ id: number }> {
    return post("/orders", params);
  }

  async function getFills(params: {
    market: FtxMarket;
    limit?: number;
  }): Promise<FtxFill[]> {
    return get(
      `/fills?market=${params.market}${
        params.limit ? `&limit=${params.limit}` : ""
      }`
    );
  }

  return {
    getAccount,
    getBalances,
    getCandles,
    getOrderBook,
    getOpenOrders,
    getOrderStatus,
    cancelOrder,
    cancelAllOrders,
    addOrder,
    getFills,
    subaccount,
  };
}

export type FtxClient = ReturnType<typeof getFtxClient>;
