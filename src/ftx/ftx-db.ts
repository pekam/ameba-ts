import {
  FtxCandleRequestParams,
  FtxClient,
  FtxMarket,
  FtxOrderBookParams,
  OrderBook,
} from "./ftx";
import { db } from "../data/mongo";
import { RawCandle } from "../core/types";
import { CandleSeries, toCandleSeries } from "../core/candle-series";

const collectionId = "ftx";

export function getFtxDb(ftx: FtxClient) {
  async function loadCandleDataToDb(
    id: string,
    params: FtxCandleRequestParams
  ) {
    const candles = await ftx.getCandles(params);
    await db.set(collectionId, id, { params, candles });
  }

  async function loadCandleDataFromDb(id: string): Promise<CandleSeries> {
    const candles: RawCandle[] = (await db.get(collectionId, id)).candles;
    return toCandleSeries(candles);
  }

  const getOrderBookDocId = (market) => "orderbooks-" + market;

  async function loadOrderBookToDb(params: FtxOrderBookParams) {
    const book = await ftx.getOrderBook(params);
    const id = getOrderBookDocId(params.market);
    // todo: optimize updating one item
    const old = await db.get(collectionId, id);
    const books = old ? old.books : [];
    books.push(book);
    await db.set(collectionId, id, { books });
  }

  async function loadOrderBooksFromDb(market: FtxMarket): Promise<OrderBook[]> {
    const result = await db.get(collectionId, getOrderBookDocId(market));
    return result && result.books;
  }

  return {
    loadCandleDataToDb,
    loadCandleDataFromDb,
    loadOrderBookToDb,
    loadOrderBooksFromDb,
  };
}
