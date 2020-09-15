import { readDataFromFile, writeDataToFile } from "./data-caching";
import { fetchFromFinnhub } from "./finnhub";

interface FinnhubSymbolResponse {
  currency: string;
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

const fileName = "symbols.json";

export function loadAndCacheSymbols() {
  fetchFromFinnhub("stock", "symbol", { exchange: "US" }).then((json) => {
    const data: FinnhubSymbolResponse[] = json;

    const usStockSymbols = data.filter(
      (symbolInfo) => symbolInfo.type === "EQS"
    );

    writeDataToFile(usStockSymbols, fileName);
  });
}

export function readCachedSymbols(): string[] {
  return readDataFromFile(fileName).map((s) => s.symbol);
}
