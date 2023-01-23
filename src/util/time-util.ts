import { dropRightWhile } from "lodash";
import { DateTime, DateTimeOptions } from "luxon";
import { isNumber, isObject, toPairs } from "remeda";

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

export const getCurrentTimestampInSeconds = () =>
  Math.floor(DateTime.utc().toSeconds());

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

export const timeframeValues = [
  "1min",
  "5min",
  "15min",
  "1h",
  "1d",
  "1w",
] as const;

export type Timeframe = (typeof timeframeValues)[number];

export function isTimeframe(s: string): s is Timeframe {
  return timeframeValues.includes(s as Timeframe);
}

const timeframeToPeriodMap: { [Property in Timeframe]: number } = {
  "1min": PERIODS.minute,
  "5min": PERIODS.minute * 5,
  "15min": PERIODS.minute * 15,
  "1h": PERIODS.hour,
  "1d": PERIODS.day,
  "1w": PERIODS.week,
};

/**
 * Note: This would not make sense for timeframes of months and years, because they have varying lengths.
 */
export function timeframeToPeriod(timeframe: Timeframe): number {
  return timeframeToPeriodMap[timeframe];
}

export function periodToTimeframe(period: number): Timeframe | null {
  const pair = toPairs(timeframeToPeriodMap).find(
    ([timeframe, tfPeriod]) => period === tfPeriod
  );
  return pair ? (pair[0] as Timeframe) : null;
}

const TIME_PROPS = ["year", "month", "day", "hour", "minute"] as const;
/**
 * Converts the given timestamp to the start of the provided unit and returns a
 * Unix timestamp as seconds.
 *
 * E.g. toStartOf("2023-10-10T10:10:10+00:00", "year") returns the timestamp of
 * 2023-01-01T00:00:00+00:00
 */
export function toStartOf(
  time: Moment,
  unit: (typeof TIME_PROPS)[number]
): number {
  const dateTime = toDateTime(time);

  const propsToCopy = dropRightWhile(TIME_PROPS, (p) => p !== unit);

  const timeObject: Record<(typeof TIME_PROPS)[number], number> =
    TIME_PROPS.reduce(
      (obj, key) =>
        propsToCopy.includes(key)
          ? {
              ...obj,
              [key]: dateTime[key],
            }
          : obj,
      {
        year: 2000, // should always be overridden
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
      }
    );

  return toTimestamp(timeObject);
}

export function toStartOfDay(time: Moment): number {
  return toStartOf(time, "day");
}

export function toNewYorkTime(timestamp: number): DateTime {
  return DateTime.fromSeconds(timestamp, { zone: "America/New_York" });
}

export function isNewYorkRTH(timestamp: number) {
  const nyTime = toNewYorkTime(timestamp);
  if (nyTime.hour < 9 || (nyTime.hour === 9 && nyTime.minute < 30)) {
    return false;
  }
  if (nyTime.hour >= 16) {
    return false;
  }
  return true;
}

/**
 * Returns a string representation of the provided time in UTC time zone.
 *
 * @param time the time to convert to string
 * @param resolution whether to show only the date part,
 * or also the time up to minutes or seconds
 */
export function toDateString(time: Moment, resolution: "d" | "m" | "s" = "m") {
  const endIndex = (() => {
    if (resolution === "d") {
      return 10;
    } else if (resolution === "m") {
      return 16;
    } else {
      return 19;
    }
  })();
  return toDateTime(time).toISO().substring(0, endIndex).replace("T", " ");
}
