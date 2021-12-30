import { identity, sort } from "remeda";
import { Candle, CandleSeries } from "../core/types";

/**
 * Supports negative index to get from the end of the array.
 */
function get<T>(array: Array<T>, index: number) {
  if (index < 0) {
    return array[array.length + index];
  } else {
    return array[index];
  }
}

function last<T>(array: Array<T>) {
  return get(array, -1);
}

/**
 * Returns the average of the provided numbers.
 */
const avg: (values: number[]) => number = (values) =>
  sum(values) / values.length;
const sum: (values: number[]) => number = (values) =>
  values.reduce((sum, value) => sum + value, 0);

const getAverageCandleSize = function (
  series: CandleSeries,
  countFromEnd: number
) {
  const head: Candle[] =
    series.length >= countFromEnd ? series.slice(-countFromEnd) : series;
  return avg(head.map((candle) => candle.high - candle.low));
};

/**
 * Expects candles to be subsequent and in order.
 */
const combineCandles = function (candles: CandleSeries): Candle {
  const volume =
    candles[0].volume !== undefined
      ? sum(candles.map((c) => c.volume || 0))
      : undefined;
  return {
    open: candles[0].open,
    close: last(candles).close,
    low: Math.min(...candles.map((c) => c.low)),
    high: Math.max(...candles.map((c) => c.high)),
    volume,
    time: candles[0].time,
  };
};

function getRelativeDiff(
  value1: number,
  value2: number,
  relativeToHigher = false
) {
  const [low, high] = sort([value1, value2], identity);
  return (high - low) / (relativeToHigher ? high : low);
}

/**
 * Type safe way to check if an optional property is present.
 */
function hasOwnProperty<T extends object>(obj: T, key: keyof T) {
  return obj.hasOwnProperty(key);
}

/**
 * Collection of utility functions.
 */
export const m = {
  get,
  last,
  avg,
  sum,
  getAverageCandleSize,
  combineCandles,
  getRelativeDiff,
  hasOwnProperty,
};
