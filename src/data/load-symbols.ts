import { fetchFromFinnhub } from "./finnhub";
import { readDataFromFile, writeDataToFile } from "./data-caching";

interface FinnhubSymbolResponse {
  currency: string;
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

const fileName = "symbols.json";

fetchFromFinnhub("stock", "symbol", { exchange: "US" }).then((json) => {
  const data: FinnhubSymbolResponse[] = json;

  const usStockSymbols = data.filter((symbolInfo) => symbolInfo.type === "EQS");

  writeDataToFile(usStockSymbols, fileName);
});

export function readCachedSymbols(): { symbol: string }[] {
  return readDataFromFile(fileName);
}
