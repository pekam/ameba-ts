import { fetchFromFinnhub } from "./finnhub";
import { writeDataToFile } from "./data-caching";

interface FinnhubSymbolResponse {
  currency: string;
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

fetchFromFinnhub("stock", "symbol", { exchange: "US" }).then((json) => {
  const data: FinnhubSymbolResponse[] = json;

  const usStockSymbols = data.filter((symbolInfo) => symbolInfo.type === "EQS");

  writeDataToFile(usStockSymbols, "symbols.json");
});
