import { readCachedSymbols } from "./load-symbols";
import { fetchFromFinnhub } from "./finnhub";
import { db } from "./mongo";
import { sortDescending } from "../util";

const collection = "company-profiles";

/**
 * Loads the company profiles of all US stock symbols
 * and saves them to the database.
 *
 * NOTE: Does not re-load already cached profiles
 */
export async function loadAndCacheProfiles() {
  (await readCachedSymbols()).forEach((symbol) => {
    db.get(collection, symbol).then((oldValue) => {
      if (!oldValue) {
        fetchFromFinnhub("stock", "profile2", { symbol }).then((data) =>
          db.set(collection, symbol, { symbol, ...data })
        );
      }
    });
  });
}

export async function readCachedProfiles(): Promise<CompanyProfile[]> {
  return db.access((db) => db.collection(collection).find().toArray());
}

export async function getStocksByMarketCap(min: number, max: number) {
  return (await readCachedProfiles()).filter(
    (profile) =>
      profile.marketCapitalization >= min && profile.marketCapitalization < max
  );
}

export async function getStocksSortedByMarketCap(count?: number) {
  const profiles = await readCachedProfiles();
  const sorted = sortDescending(
    profiles,
    (profile) => profile.marketCapitalization
  );
  return count ? sorted.slice(0, count) : sorted;
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

// loadAndCacheProfiles();
