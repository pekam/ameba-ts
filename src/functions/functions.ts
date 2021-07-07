import { Candle, CandleSeries, OHLC } from "../core/types";
import { getSwingHighs, getSwingLows } from "./swing-highs-lows";
import { candlePatterns } from "./candle-patterns";
import { candleUtils } from "./candle-utils";
import { timestampFromUTC } from "../core/date-util";
import { PERIODS } from "../util";
import _ = require("lodash");

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

function previous(candles: CandleSeries, candle: Candle): Candle | undefined {
  const index = indexOf(candles, candle);
  return candles[index - 1];
}

function relativeChange(candle: Candle, previous?: Candle): number {
  const oldValue = previous ? previous.close : candle.open;
  return (candle.close - oldValue) / oldValue;
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

function sortAscending<T>(items: T[], sortBy: (item: T) => number): T[] {
  return items.slice().sort((a, b) => sortBy(a) - sortBy(b));
}

function sortDescending<T>(items: T[], sortBy: (item: T) => number): T[] {
  return items.slice().sort((a, b) => sortBy(b) - sortBy(a));
}

/**
 * Applies the function to the value if the condition is true, otherwise
 * returns the value.
 */
const applyIf = <T>(condition: boolean, func: (input: T) => T, value: T): T => {
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
 * Expects candles to be subsequent and in order.
 */
const combineCandles = function (candles: CandleSeries): Candle {
  const volume =
    candles[0].volume !== undefined
      ? sum(candles.map((c) => c.volume || 0))
      : undefined;
  const time = candles[0].time;
  return { ...combine(candles), volume, time };
};

const combineMinuteCandles = function (
  candles: CandleSeries,
  periodAsSeconds: number
): CandleSeries {
  const grouped = _.groupBy(candles, (c) =>
    Math.floor(c.time / periodAsSeconds)
  );
  return Object.values(grouped).map((value) => combineCandles(value));
};

const combineMinuteToHourlyCandles = function (
  candles: CandleSeries
): CandleSeries {
  return combineMinuteCandles(candles, PERIODS.hour);
};

const getCandlesBetween = function (
  candles: CandleSeries,
  candle1: Candle,
  candle2: Candle
): CandleSeries {
  const index1 = indexOf(candles, candle1);
  const index2 = indexOf(candles, candle2);
  if (index1 < 0 || index2 < 0) {
    throw new Error("Candle not found in series.");
  }
  const lowIndex = Math.min(index1, index2);
  const highIndex = Math.max(index1, index2);
  return candles.slice(lowIndex + 1, highIndex);
};

function getRelativeDiff(
  value1: number,
  value2: number,
  relativeToHigher = false
) {
  const [low, high] = sortAscending([value1, value2], (v) => v);
  return (high - low) / (relativeToHigher ? high : low);
}

function isGrowingSeries(values: number[]): boolean {
  return values.every((value, i) => i === 0 || value > values[i - 1]);
}

function isDecreasingSeries(values: number[]): boolean {
  return values.every((value, i) => i === 0 || value < values[i - 1]);
}

function isBetween({
  value,
  low,
  high,
}: {
  value: number;
  low: number;
  high: number;
}): boolean {
  return value > low && value < high;
}

function takeCandlesAfter(series: CandleSeries, time: number): CandleSeries {
  return _.takeRightWhile(series, (c) => c.time > time);
}

/**
 * The first item has biggest weight and the last item
 * has the smallest weight.
 */
function getWeightedAverage(values: number[]) {
  // Function copied from weighted-mean npm module which doesn't have ts types
  function weightedMean(weightedValues: number[][]) {
    const totalWeight = weightedValues.reduce(function (sum, weightedValue) {
      return sum + weightedValue[1];
    }, 0);
    return weightedValues.reduce(function (mean, weightedValue) {
      return mean + (weightedValue[0] * weightedValue[1]) / totalWeight;
    }, 0);
  }

  const valuesWithWeights = values.map((profit, i) => [
    profit,
    values.length - i,
  ]);
  return weightedMean(valuesWithWeights);
}

/**
 * @param dateString in YYYY-MM-DD format
 */
function dateStringToTimestamp(dateString: string) {
  if (!/^\d{4}\-\d{1,2}\-\d{1,2}$/.test(dateString)) {
    throw Error("Date string not matching format YYYY-MM-DD");
  }
  const [year, month, day] = dateString.split("-").map((s) => parseInt(s));
  return timestampFromUTC(year, month, day);
}

/**
 * Collection of utility functions.
 */
export const m = {
  get,
  last,
  indexOf,
  previous,
  relativeChange,
  avg,
  sum,
  range,
  sortAscending,
  sortDescending,
  applyIf,
  getAverageCandleSize,
  combine,
  combineCandles,
  combineMinuteCandles,
  combineMinuteToHourlyCandles,
  getCandlesBetween,
  getRelativeDiff,
  isGrowingSeries,
  isDecreasingSeries,
  isBetween,
  takeCandlesAfter,
  getWeightedAverage,
  dateStringToTimestamp,

  getSwingHighs,
  getSwingLows,
  ...candlePatterns,
  ...candleUtils,
};
