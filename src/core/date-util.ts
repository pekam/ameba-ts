import { DateTime } from "luxon";

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
