import { toPairs } from "remeda";

export const TIMEFRAMES = ["1min", "5min", "15min", "1h", "1d", "1w"] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

export function isTimeframe(s: string): s is Timeframe {
  return TIMEFRAMES.includes(s as Timeframe);
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
} as const;

const TIMEFRAME_TO_PERIOD: { [Property in Timeframe]: number } = {
  "1min": PERIODS.minute,
  "5min": PERIODS.minute * 5,
  "15min": PERIODS.minute * 15,
  "1h": PERIODS.hour,
  "1d": PERIODS.day,
  "1w": PERIODS.week,
} as const;

/**
 * Returns the length of the timeframe as seconds.
 *
 * Note: This would not make sense for timeframes of months and years (if
 * added), because they have varying lengths.
 */
export function timeframeToPeriod(timeframe: Timeframe): number {
  return TIMEFRAME_TO_PERIOD[timeframe];
}

/**
 * Returns the timeframe that has length in seconds equal to provided period, or
 * null if matching timeframe doesn't exist.
 */
export function periodToTimeframe(period: number): Timeframe | null {
  const pair = toPairs(TIMEFRAME_TO_PERIOD).find(
    ([timeframe, tfPeriod]) => period === tfPeriod
  );
  return pair ? (pair[0] as Timeframe) : null;
}

export function isIntraday(timeframe: Timeframe): boolean {
  return timeframeToPeriod(timeframe) < timeframeToPeriod("1d");
}
