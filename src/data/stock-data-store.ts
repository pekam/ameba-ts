/*
 * Candles are loaded from Finnhub and cached in mongodb on demand.
 */

import { concat } from "lodash";
import { CandleSeries } from "../core/types";
import {
  getCurrentTimestampInSeconds,
  Moment,
  PERIODS,
  toStartOfDay,
  toTimestamp,
} from "../shared/time-util";
import { loadCandles } from "./load-candle-data";
import { db } from "./mongo";

const collectionId = "stock-daily-candles";

/**
 * How many candles before/after the requested ones to load in addition.
 * This reduces the need for further requests.
 */
const extraPeriodToLoad = PERIODS.day * 100;

async function getDailyCandles(args: {
  symbol: string;
  from: Moment;
  to: Moment;
}): Promise<CandleSeries> {
  const { symbol } = args;
  const from = toTimestamp(args.from);
  const to = toTimestamp(args.to);

  const now = getCurrentTimestampInSeconds();
  const yesterday = toStartOfDay(now - PERIODS.day);

  if (now - to < PERIODS.day) {
    // TODO handle loading for the current day
    throw Error(
      "Fetching data for the current day is not supported yet. " +
        "It needs special handling because it's potentially incomplete " +
        "and should be reloaded on further requests."
    );
  }

  async function getFromDb(): Promise<DbEntry | undefined> {
    return await db.get(collectionId, symbol);
  }
  async function setToDb(entry: DbEntry): Promise<void> {
    await db.set(collectionId, symbol, entry);
  }
  async function getFromInternet({
    from,
    to,
  }: {
    from: Moment;
    to: Moment;
  }): Promise<CandleSeries> {
    return loadCandles({
      from,
      to,
      symbol,
      market: "stock",
      resolution: "D",
    });
  }

  const entryFromDb: DbEntry | undefined = await getFromDb();

  const wasDbUpdated: boolean = await (async () => {
    if (!entryFromDb) {
      const range = {
        from: from - extraPeriodToLoad,
        to: Math.min(to, yesterday),
      };
      const candles: CandleSeries = await getFromInternet(range);
      await setToDb({ candles, symbol, ...range });
      return true;
    } else {
      let range = { from: entryFromDb.from, to: entryFromDb.to };

      const candlesBefore = await (async () => {
        if (from >= entryFromDb.from) {
          return [];
        }
        range.from = from - extraPeriodToLoad;
        return await getFromInternet({
          from: range.from,
          to: entryFromDb.from,
        });
      })();

      const candlesAfter = await (async () => {
        if (to <= entryFromDb.to) {
          return [];
        }
        range.to = Math.min(to + extraPeriodToLoad, yesterday);
        return await getFromInternet({
          from: entryFromDb.to,
          to: range.to,
        });
      })();

      if (!candlesBefore.length && !candlesAfter.length) {
        return false;
      }

      const allCandles = concatSeries(
        candlesBefore,
        entryFromDb.candles,
        candlesAfter
      );
      await setToDb({
        symbol,
        candles: allCandles,
        ...range,
      });
      return true;
    }
  })();

  const entry: DbEntry = wasDbUpdated ? (await getFromDb())! : entryFromDb!;

  return entry.candles.filter((c) => c.time >= from && c.time <= to);
}

/**
 * Assuming the serieses to be in order, but with potential overlaps.
 */
function concatSeries(...serieses: CandleSeries[]): CandleSeries {
  if (!serieses.length) {
    return [];
  }
  return concat(serieses[0], ...serieses.slice(1, serieses.length)).filter(
    (candle, i, series) => {
      const prev = series[i - 1];
      // Filters overlaps
      return !prev || prev.time < candle.time;
    }
  );
}

interface DbEntry {
  symbol: string;
  candles: CandleSeries;
  /**
   * The earliest timestamp that has been requested for this entry. It might still not have
   * candle for that specific timestamp.
   */
  from: number;
  /**
   * The latest timestamp that has been requested for this entry. It might still not have
   * candle for that specific timestamp.
   */
  to: number;
}

export const stockDataStore = {
  getDailyCandles,
};
