import { readCachedSymbols } from "./load-symbols";
import { fetchFromFinnhub } from "./finnhub";
import { isCached, readDataFromFile, writeDataToFile } from "./data-caching";

const getProfileFileName = (symbol: string) => `profile.${symbol}.json`;

/**
 * NOTE: Does not re-load already cached file
 */
export function loadAndCacheProfiles() {
  readCachedSymbols()
    .map((symbol) => ({ symbol, fileName: getProfileFileName(symbol) }))
    .filter(({ symbol, fileName }) => !isCached(fileName))
    .forEach(({ symbol, fileName }) => {
      fetchFromFinnhub("stock", "profile2", { symbol }).then((data) => {
        writeDataToFile(data, fileName);
      });
    });
}

export function readCachedProfiles(): CompanyProfile[] {
  return readCachedSymbols().map((symbol) => {
    return { symbol, ...readDataFromFile(getProfileFileName(symbol)) };
  });
}

export function getStocksByMarketCap(min: number, max: number) {
  return readCachedProfiles().filter(
    (profile) =>
      profile.marketCapitalization >= min && profile.marketCapitalization < max
  );
}

export function getMidCapStocks() {
  return getStocksByMarketCap(2000, 10000);
}

// https://finnhub.io/docs/api#company-profile2
export interface CompanyProfile {
  symbol: string;
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  /**
   * In millions.
   */
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
  logo: string;
  finnhubIndustry: string;
}
