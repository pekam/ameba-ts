import { Range } from "../core/types";
import { m } from "../shared/functions";
import { fetchFromFinnhub } from "./finnhub";
import { readCachedSymbols } from "./load-symbols";
import { db } from "./mongo";

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

/**
 * In millions.
 */
export const MARKET_CAPS = {
  micro: { from: 50, to: 300 },
  small: { from: 300, to: 2000 },
  mid: { from: 2000, to: 10000 },
  large: { from: 10000, to: 200000 },
  mega: { from: 200000, to: Infinity },
} as const;

/**
 * @param range in millions
 */
export async function getStocksByMarketCap(range: Range) {
  return (await readCachedProfiles()).filter(
    (profile) =>
      profile.marketCapitalization >= range.from &&
      profile.marketCapitalization < range.to
  );
}

export async function getStocksSortedByMarketCap(count?: number) {
  const profiles = await readCachedProfiles();
  const sorted = m.sortDescending(
    profiles,
    (profile) => profile.marketCapitalization
  );
  return count ? sorted.slice(0, count) : sorted;
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
