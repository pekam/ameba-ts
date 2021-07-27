import { DateTime } from "luxon";
import { FtxResolution } from "../ftx/ftx";

/**
 * Result is in seconds.
 *
 * @param year
 * @param month 1-12
 * @param date
 * @param hours
 * @param minutes
 * @param seconds
 */
export function timestampFromUTC(
  year: number,
  month: number,
  date?: number,
  hours?: number,
  minutes?: number,
  seconds?: number
) {
  return Math.floor(
    Date.UTC(
      year,
      month - 1,
      date || 1,
      hours || 0,
      minutes || 0,
      seconds || 0,
      0
    ) / 1000
  );
}

export function getTimeInNewYork(timestamp: number): DateTime {
  return DateTime.fromSeconds(timestamp).setZone("America/New_York");
}

export function timestampToUTCDateString(timestamp: number) {
  return new Date(timestamp * 1000).toUTCString();
}

const second = 1,
  minute = second * 60,
  hour = minute * 60,
  day = hour * 24,
  week = day * 7;
/**
 * Time periods as seconds.
 */
export const PERIODS = {
  second,
  minute,
  hour,
  day,
  week,
};

export const ftxResolutionToPeriod: {
  [Property in FtxResolution]: number;
} = {
  "15sec": PERIODS.second * 15,
  "1min": PERIODS.minute,
  "5min": PERIODS.minute * 5,
  "15min": PERIODS.minute * 15,
  "1h": PERIODS.hour,
  "4h": PERIODS.hour * 4,
  "1d": PERIODS.day,
};
