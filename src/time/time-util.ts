import { DateTime } from "luxon";
import { Moment, toDateTime } from "./moment";

/**
 * Returns a string representation of the provided time in UTC time zone.
 *
 * @param time the time to convert to string
 * @param resolution whether to show only the date part, or also the time up to
 * minutes or seconds
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

export const getCurrentTimestampInSeconds = () =>
  Math.floor(DateTime.utc().toSeconds());

export function toNewYorkTime(moment: Moment): DateTime {
  return toDateTime(moment).setZone("America/New_York");
}

/**
 * Returns true if the time of day is between the regular trading hours in New
 * York's stock exchanges (9:30-16:00).
 *
 * NOTE: This does not check whether the stock market is open that day.
 */
export function isNewYorkRTH(moment: Moment) {
  const nyTime = toNewYorkTime(moment);
  if (nyTime.hour < 9 || (nyTime.hour === 9 && nyTime.minute < 30)) {
    return false;
  }
  if (nyTime.hour >= 16) {
    return false;
  }
  return true;
}
