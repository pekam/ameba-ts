import { readCachedSymbols } from "./load-symbols";
import { fetchFromFinnhub } from "./finnhub";
import { isCached, writeDataToFile } from "./data-caching";

// NOTE: Does not re-load already cached file

const symbols = readCachedSymbols().map((s) => s.symbol);

symbols
  .map((symbol) => ({ symbol, fileName: `profile.${symbol}.json` }))
  .filter(({ symbol, fileName }) => !isCached(fileName))
  .forEach(({ symbol, fileName }) => {
    fetchFromFinnhub("stock", "profile2", { symbol }).then((data) => {
      writeDataToFile(data, fileName);
    });
  });
