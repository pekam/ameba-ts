import { FtxClient, FtxMarket, FtxOrderBookParams, OrderBook } from "./ftx";
import { db } from "../data/mongo";
import { CandleSeries } from "../core/types";

const collectionId = "ftx";

export function getFtxDb(ftx: FtxClient) {
  async function saveCandleDataToDb(id: string, candles: CandleSeries) {
    await db.set(collectionId, id, { candles });
  }

  async function loadCandleDataFromDb(id: string): Promise<CandleSeries> {
    return (await db.get(collectionId, id)).candles;
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
    saveCandleDataToDb,
    loadCandleDataFromDb,
    loadOrderBookToDb,
    loadOrderBooksFromDb,
  };
}
