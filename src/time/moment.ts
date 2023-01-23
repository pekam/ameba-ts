import { DateTime, DateTimeOptions } from "luxon";
import { isNumber, isObject } from "remeda";

/**
 * A point in time (timestamp).
 *
 * Either ISO date string (UTC), Unix timestamp as seconds, luxon DateTime, Date
 * object or a simple object with date properties (UTC).
 */
export type Moment =
  | string
  | number
  | DateTime
  | Date
  | {
      year: number;
      month: number;
      day?: number;
      hour?: number;
      minute?: number;
      second?: number;
    };

export function isMoment(input: any): input is Moment {
  try {
    toDateTime(input as Moment);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * @returns date time in UTC time zone
 */
export function toDateTime(input: Moment): DateTime {
  if (DateTime.isDateTime(input)) {
    return input.toUTC();
  }
  const options: DateTimeOptions = { zone: "utc" };
  if (typeof input === "string") {
    const dateTime = DateTime.fromISO(input, options);
    if (dateTime.invalidExplanation) {
      throw Error(dateTime.invalidExplanation);
    }
    return dateTime;
  } else if (typeof input === "number") {
    return DateTime.fromSeconds(input, options);
  } else if (input instanceof Date) {
    return DateTime.fromJSDate(input);
  } else if (isObject(input) && isNumber(input.year) && isNumber(input.month)) {
    return DateTime.fromObject(input, options);
  }
  throw Error("Input is not an instance of Moment");
}

/**
 * @returns timestamp as seconds
 */
export function toTimestamp(input: Moment): number {
  if (typeof input === "number") {
    return input;
  }
  return Math.floor(toDateTime(input).toSeconds());
}

export function toJSDate(input: Moment): Date {
  return toDateTime(input).toJSDate();
}

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
