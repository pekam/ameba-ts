import { fetchFromFinnhub } from "./finnhub";
import { db } from "./mongo";

interface FinnhubSymbolResponse {
  currency: string;
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

const key = "symbols";

/**
 * Replaces the entire collection by removing the old data first.
 */
export async function loadAndCacheSymbols() {
  fetchFromFinnhub("stock", "symbol", { exchange: "US" }).then(async (json) => {
    const data: FinnhubSymbolResponse[] = json;
    const usStockSymbols = data.filter(
      (symbolInfo) => symbolInfo.type === "EQS"
    );

    await db.removeAll(key);
    await db.access((db) =>
      db
        .collection(key)
        .insertMany(usStockSymbols.map((sym) => ({ ...sym, _id: sym.symbol })))
    );
  });
}

export async function readCachedSymbols(): Promise<string[]> {
  return await db.access((db) => {
    return db
      .collection(key)
      .find()
      .map((s) => s.symbol)
      .toArray();
  });
}
