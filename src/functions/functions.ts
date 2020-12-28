import { CandleSeries } from "../core/candle-series";
import { Candle } from "../core/types";
import { getSwingHighs, getSwingLows } from "./swing-highs-lows";

function last<T>(array: Array<T>) {
  return array[array.length - 1];
}

/**
 * Returns the average of the provided numbers.
 */
const avg: (values: number[]) => number = (values) =>
  sum(values) / values.length;
const sum: (values: number[]) => number = (values) =>
  values.reduce((sum, value) => sum + value, 0);
const range: (length: number) => number[] = (length) =>
  Array.from(Array(length).keys());

function sortDescending<T>(items: T[], sortBy: (item: T) => number): T[] {
  return items.slice().sort((a, b) => sortBy(b) - sortBy(a));
}

/**
 * Applies the function to the value if the condition is true, otherwise
 * returns the value.
 */
const applyIf = <T>(condition: boolean, func: (T) => T, value: T): T => {
  if (condition) {
    return func(value);
  } else {
    return value;
  }
};

const getAverageCandleSize = function (
  series: CandleSeries,
  countFromEnd: number
) {
  const head: Candle[] =
    series.length >= countFromEnd ? series.slice(-countFromEnd) : series;
  return avg(head.map((candle) => candle.high - candle.low));
};

/**
 * Collection of utility functions.
 */
export const m = {
  last,
  avg,
  sum,
  range,
  sortDescending,
  applyIf,
  getAverageCandleSize,
  getSwingHighs,
  getSwingLows,
};
