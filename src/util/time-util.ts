import { DateTime, DateTimeOptions } from "luxon";

export type Moment =
  | string
  | number
  | Date
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
export function toTimestamp(input: Moment): number {
  if (typeof input === "number") {
    return input;
  }
  return Math.floor(toDateTime(input).toSeconds());
}

/**
 * @param input either ISO date string (UTC), timestamp as seconds or object with date props (UTC)
 * @returns date time in UTC time zone
 */
export function toDateTime(input: Moment): DateTime {
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
  } else {
    return DateTime.fromObject(input, options);
  }
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
