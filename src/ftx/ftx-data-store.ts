import { flatten } from "lodash";
import { DateTime } from "luxon";
import { CandleSeries } from "../core/types";
import { db } from "../data/mongo";
import { properties } from "../properties";
import { m } from "../shared/functions";
import {
  ftxResolutionToPeriod,
  getCurrentTimestampInSeconds,
  PERIODS,
  toDateTime,
} from "../shared/time-util";
import { FtxMarket, FtxResolution, getFtxClient } from "./ftx";
import { FtxUtil, getFtxUtil } from "./ftx-util";

/*
 * Candles are loaded from FTX and cached in 1 month chunks in mongodb, on demand.
 */

const collectionId = "ftx-candles";

function getDocumentId(market: FtxMarket, date: DateTime) {
  const monthYearString = date.toISO().substring(0, 7);
  return market + "-" + monthYearString;
}

/**
 * Returns data from mongodb. If the data does not yet exist,
 * it first loads the required candles from FTX to mongodb.
 */
async function getCandles(args: {
  market: FtxMarket;
  resolution: FtxResolution;
  startDate: string | number;
  endDate: string | number;
}): Promise<CandleSeries> {
  const startDate = toDateTime(args.startDate);
  const endDate = toDateTime(args.endDate);

  if (startDate.toMillis() >= endDate.toMillis()) {
    throw Error("startDate should be before endDate");
  }

  const ftxUtil = getFtxUtil({
    ftx: getFtxClient({ subaccount: properties.ftx_data_subaccount }),
    market: args.market,
  });

  const months = getMonthsToLoad(startDate, endDate);

  const minuteCandles: CandleSeries = flatten(
    await Promise.all(
      months.map((date) => loadMonthMinuteCandles(ftxUtil, date))
    )
  ).filter((c, i, series) => {
    // Filter time period
    if (c.time < startDate.toSeconds() || c.time >= endDate.toSeconds()) {
      return false;
    }
    // Filter duplicates just in case
    const prev = series[i - 1];
    return !prev || c.time !== prev.time;
  });

  return m.combineMinuteCandles(
    minuteCandles,
    ftxResolutionToPeriod[args.resolution]
  );
}

/**
 * Loads minute candles for the full month from DB.
 * If the DB doesn't yet have data for that month (or if it's incomplete),
 * it is first loaded from FTX.
 */
async function loadMonthMinuteCandles(
  ftxUtil: FtxUtil,
  date: DateTime
): Promise<CandleSeries> {
  const documentId = getDocumentId(ftxUtil.market, date);

  if (getCurrentTimestampInSeconds() < date.toSeconds()) {
    console.log("Month in the future, skipping: " + documentId);
    return [];
  }

  async function getFromDb(): Promise<DbEntry | undefined> {
    return await db.get(collectionId, documentId);
  }

  async function setToDb(entry: DbEntry): Promise<void> {
    return await db.set(collectionId, documentId, entry);
  }

  const data: DbEntry | undefined = await getFromDb();

  if (data && data.complete) {
    return data.candles;
  }

  const minuteCandles: CandleSeries = await (async () => {
    const endDate = Math.min(
      toNextMonth(date).toSeconds(),
      getCurrentTimestampInSeconds() + 100
    );
    if (data) {
      // Try to continue the existing chunk with new data
      console.log("Extending candle chunk: " + documentId);
      const startTime = m.last(data.candles).time;
      const newMinuteCandles: CandleSeries = await ftxUtil.getCandles({
        startDate: startTime,
        endDate,
        resolution: "1min",
      });
      return m.filterConsecutiveDuplicates(
        data.candles.concat(newMinuteCandles)
      );
    } else {
      // Get the entire chunk
      console.log("Loading candle chunk: " + documentId);
      return await ftxUtil.getCandles({
        startDate: date.toSeconds(),
        endDate,
        resolution: "1min",
      });
    }
  })();

  if (!minuteCandles.length) {
    // Month in the future
    return [];
  }

  // Not perfect solution...
  const complete =
    getCurrentTimestampInSeconds() - m.last(minuteCandles).time > PERIODS.day;

  await setToDb({ candles: minuteCandles, complete });

  const newData: DbEntry | undefined = await getFromDb();
  if (!newData) {
    throw Error("The newly stored data not found from db");
  }
  return newData.candles;
}

function getMonthsToLoad(startDate: DateTime, endDate: DateTime): DateTime[] {
  const months = [toFirstDayOfMonth(startDate)];
  while (!isSameMonth(m.last(months), endDate)) {
    months.push(toNextMonth(m.last(months)));
  }
  return months;
}

function toNextMonth(date: DateTime): DateTime {
  const nextYear = date.month === 12;

  const month = nextYear ? 1 : date.month + 1;
  const year = nextYear ? date.year + 1 : date.year;
  const day = 1;

  return toDateTime({ year, month, day });
}

function toFirstDayOfMonth(date: DateTime): DateTime {
  return toDateTime({ year: date.year, month: date.month, day: 1 });
}

function isSameMonth(date1: DateTime, date2: DateTime): boolean {
  return date1.year === date2.year && date1.month === date2.month;
}

interface DbEntry {
  candles: CandleSeries;
  /**
   * True if the entire month's data is loaded.
   * False if it was last fetched before that month was finished,
   * so there might be new data stil to be loaded.
   */
  complete: boolean;
}

export const ftxDataStore = {
  getCandles,
};
