import { CandleSeries } from "../core/candle-series";
import { Candle, OHLC } from "../core/types";
import { getSwingHighs, getSwingLows } from "./swing-highs-lows";
import { candlePatterns } from "./candle-patterns";

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

function indexOf(candles: CandleSeries, candle: Candle): number {
  if (candles.length === 0) {
    throw new Error("Candle not found.");
  }
  const i = Math.floor(candles.length / 2);
  const t = candles[i].time;
  if (t === candle.time) {
    return i;
  } else if (t > candle.time) {
    return indexOf(candles.slice(0, i), candle);
  } else {
    return indexOf(candles.slice(i + 1, candles.length), candle) + i + 1;
  }
}

function previous(candles: CandleSeries, candle: Candle): Candle {
  const index = indexOf(candles, candle);
  return candles[index - 1];
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

const combine = function (candles: CandleSeries): OHLC {
  return {
    open: candles[0].open,
    close: last(candles).close,
    low: Math.min(...candles.map((c) => c.low)),
    high: Math.max(...candles.map((c) => c.high)),
  };
};

/**
 * Collection of utility functions.
 */
export const m = {
  get,
  last,
  indexOf,
  previous,
  avg,
  sum,
  range,
  sortDescending,
  applyIf,
  getAverageCandleSize,
  combine,
  getSwingHighs,
  getSwingLows,
  ...candlePatterns,
};
