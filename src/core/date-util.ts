/**
 * @param year
 * @param month 1-12
 * @param date
 * @param hours
 * @param minutes
 * @param seconds
 * @param ms
 */
export function timestampFromUTC(
  year: number,
  month: number,
  date?: number,
  hours?: number,
  minutes?: number,
  seconds?: number,
  ms?: number
) {
  return Math.floor(
    Date.UTC(
      year,
      month - 1,
      date,
      hours || 0,
      minutes || 0,
      seconds || 0,
      ms || 0
    ) / 1000
  );
}