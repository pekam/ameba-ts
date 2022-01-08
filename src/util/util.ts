import { fromPairs as remedaFromPairs, identity, sort } from "remeda";
import { Candle, CandleSeries } from "../core/types";

/**
 * Supports negative index to get from the end of the array.
 */
export function get<T>(array: Array<T>, index: number) {
  if (index < 0) {
    return array[array.length + index];
  } else {
    return array[index];
  }
}

export function last<T>(array: Array<T>) {
  return get(array, -1);
}

/**
 * Returns the average of the provided numbers.
 */
export function avg(values: number[]): number {
  return sum(values) / values.length;
}
export function sum(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

export function getAverageCandleSize(
  series: CandleSeries,
  countFromEnd: number
) {
  const head: Candle[] =
    series.length >= countFromEnd ? series.slice(-countFromEnd) : series;
  return avg(head.map((candle) => candle.high - candle.low));
}

/**
 * Expects candles to be subsequent and in order.
 */
export function combineCandles(candles: CandleSeries): Candle {
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
}

export function getRelativeDiff(
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
export function hasOwnProperty<T extends object>(obj: T, key: keyof T) {
  return obj.hasOwnProperty(key);
}

/**
 * Same as Remeda's fromPairs, but with the key-type enforced as string. This
 * fixes an issue where the Remeda function's return type has `string | number`
 * as the key type, even though the input uses strings.
 */
export const fromPairs = <T>(pairs: [string, T][]) => remedaFromPairs(pairs);
