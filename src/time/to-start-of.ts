import { dropLastWhile } from "../util/util";
import { Moment, toDateTime, toTimestamp } from "./moment";

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

  const propsToCopy = dropLastWhile(TIME_PROPS, (p) => p !== unit);

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
