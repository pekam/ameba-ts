import { flatten } from "lodash";
import { timestampFromUTC } from "../core/date-util";
import { CandleSeries } from "../core/types";
import { db } from "../data/mongo";
import { m } from "../functions/functions";
import { getCurrentTimestampInSeconds, PERIODS } from "../util";
import { FtxMarket, FtxResolution, ftxResolutionToPeriod } from "./ftx";
import { FtxUtil } from "./ftx-util";

/*
 * Candles are loaded from FTX and cached in 1 month chunks in mongodb, on demand.
 */

const collectionId = "ftx-candles";

function getDocumentId(market: FtxMarket, date: MyDate) {
  return market + "-" + date.monthYearString;
}

/**
 * Returns data from mongodb. If the data does not yet exist,
 * it first loads the required candles from FTX to mongodb.
 */
async function getCandles(args: {
  ftxUtil: FtxUtil;
  resolution: FtxResolution;
  startDate: string;
  endDate: string;
}): Promise<CandleSeries> {
  const startDate = stringToMyDate(args.startDate);
  const endDate = stringToMyDate(args.endDate);

  if (startDate.timestamp >= endDate.timestamp) {
    throw Error("startDate should be before endDate");
  }

  const months = getMonthsToLoad(startDate, endDate);

  const minuteCandles: CandleSeries = flatten(
    await Promise.all(
      months.map((date) => loadMonthMinuteCandles(args.ftxUtil, date))
    )
  ).filter((c, i, series) => {
    // Filter time period
    if (c.time < startDate.timestamp || c.time >= endDate.timestamp) {
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
  date: MyDate
): Promise<CandleSeries> {
  const documentId = getDocumentId(ftxUtil.market, date);

  if (getCurrentTimestampInSeconds() < date.timestamp) {
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
      toNextMonth(date).timestamp,
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
        startDate: date.timestamp,
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

function getMonthsToLoad(startDate: MyDate, endDate: MyDate): MyDate[] {
  const months = [toFirstDayOfMonth(startDate)];
  while (m.last(months).monthYearString !== endDate.monthYearString) {
    months.push(toNextMonth(m.last(months)));
  }
  return months;
}

function stringToMyDate(dateString: string): MyDate {
  const obj = m.dateStringToObject(dateString);
  return objectToMyDate(obj);
}

function objectToMyDate(obj: {
  year: number;
  month: number;
  day: number;
}): MyDate {
  const dateString = m.objectToDateString(obj);
  return {
    dateString,
    monthYearString: dateString.substr(0, dateString.lastIndexOf("-")),
    timestamp: timestampFromUTC(obj.year, obj.month, obj.day),
    ...obj,
  };
}

function toNextMonth(date: MyDate): MyDate {
  const nextYear = date.month === 12;

  const month = nextYear ? 1 : date.month + 1;
  const year = nextYear ? date.year + 1 : date.year;
  const day = 1;

  return objectToMyDate({ year, month, day });
}

function toFirstDayOfMonth(date: MyDate): MyDate {
  return objectToMyDate({ year: date.year, month: date.month, day: 1 });
}

interface MyDate {
  dateString: string;
  monthYearString: string;
  timestamp: number;
  year: number;
  month: number;
  day: number;
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
