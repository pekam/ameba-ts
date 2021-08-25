/*
 * Candles are loaded from Finnhub and cached in mongodb on demand.
 */

import { concat } from "lodash";
import { CandleSeries } from "../core/types";
import { m } from "../shared/functions";
import {
  getCurrentTimestampInSeconds,
  Moment,
  PERIODS,
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

  if (getCurrentTimestampInSeconds() - to < PERIODS.day) {
    // TODO handle loading for the current day
    throw Error(
      "Fetching data for the current day is not supported yet. " +
        "It needs special handling because it's potentially incomplete " +
        "and should be reloaded on further requests."
    );
  }

  async function getFromDb(): Promise<CandleSeries> {
    const entry: DbEntry | undefined = await db.get(collectionId, symbol);
    return entry?.candles || [];
  }
  async function setToDb(candles: CandleSeries): Promise<void> {
    const entry: DbEntry = { symbol, candles };
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

  const candlesFromDb = await getFromDb();

  const wasDbUpdated: boolean = await (async () => {
    if (!candlesFromDb.length) {
      const candles: CandleSeries = await getFromInternet({
        from: from - extraPeriodToLoad,
        to,
      });
      await setToDb(candles);
      return true;
    } else {
      const firstCandleTime = candlesFromDb[0].time;
      const lastCandleTime = m.last(candlesFromDb).time;

      const candlesBefore =
        from < firstCandleTime
          ? await getFromInternet({
              from: from - extraPeriodToLoad,
              to: firstCandleTime,
            })
          : [];

      const candlesAfter = await (async () => {
        if (to <= lastCandleTime) {
          return [];
        }
        const candles = await getFromInternet({
          from: lastCandleTime,
          to: to + extraPeriodToLoad,
        });
        // Filter out the last candle if it might be still incomplete
        if (
          candles.length &&
          m.last(candles).time > getCurrentTimestampInSeconds() - PERIODS.day
        ) {
          return candles.slice(0, candles.length - 1);
        }
        return candles;
      })();

      if (!candlesBefore.length && !candlesAfter.length) {
        return false;
      }

      const allCandles = concatSeries(
        candlesBefore,
        candlesFromDb,
        candlesAfter
      );
      await setToDb(allCandles);
      return true;
    }
  })();

  const candles: CandleSeries = wasDbUpdated
    ? await getFromDb()
    : candlesFromDb;

  return candles.filter((c) => c.time >= from && c.time <= to);
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
}

export const stockDataStore = {
  getDailyCandles,
};
