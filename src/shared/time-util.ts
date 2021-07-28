import { DateTime, DateTimeOptions } from "luxon";
import { FtxResolution } from "../ftx/ftx";

type MomentType =
  | string
  | number
  | {
      year: number;
      month: number;
      day?: number;
      hour?: number;
      minute?: number;
      second?: number;
    };

/**
 * @param input either ISO date string (UTC), timestamp as seconds or object with date props (UTC)
 * @returns timestamp as seconds
 */
export function toTimestamp(input: MomentType): number {
  return Math.floor(toDateTime(input).toSeconds());
}

/**
 * @param input either ISO date string (UTC), timestamp as seconds or object with date props (UTC)
 * @returns date time in UTC time zone
 */
export function toDateTime(input: MomentType): DateTime {
  const options: DateTimeOptions = { zone: "utc" };
  if (typeof input === "string") {
    const dateTime = DateTime.fromISO(input, options);
    if (dateTime.invalidExplanation) {
      throw Error(dateTime.invalidExplanation);
    }
    return dateTime;
  } else if (typeof input === "number") {
    return DateTime.fromSeconds(input, options);
  } else {
    return DateTime.fromObject({ ...input, ...options });
  }
}

export const getCurrentTimestampInSeconds = () =>
  Math.floor(DateTime.utc().toSeconds());

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
  day?: number,
  hour?: number,
  minute?: number,
  second?: number
) {
  return toTimestamp({ year, month, day, hour, minute, second });
}

export function getTimeInNewYork(timestamp: number): DateTime {
  return DateTime.fromSeconds(timestamp, { zone: "America/New_York" });
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
