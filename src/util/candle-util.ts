import { Candle } from "../core/types";
import { avg, last, sum } from "./util";

/**
 * @returns the candle's volume multiplied by its average price
 */
export const getDollarVolume = (candle: Candle) =>
  candle.volume * avg([candle.low, candle.high]);

/**
 * Aggregates multiple candles to a single candle of a higher timeframe.
 *
 * Example use case: call with 60 1-minute candles with timestamps ranging from
 * 9:00 to 9:59 to get a 1-hour candle with start time of 9:00.
 *
 * Expects candles to be subsequent and in order. The array should not be empty.
 */
export const combineCandles = (candles: Candle[]): Candle => ({
  open: candles[0].open,
  close: last(candles).close,
  low: Math.min(...candles.map((c) => c.low)),
  high: Math.max(...candles.map((c) => c.high)),
  volume: sum(candles.map((c) => c.volume)),
  time: candles[0].time,
});
