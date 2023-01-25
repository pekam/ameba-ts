import _ from "lodash";
import {
  fromPairs as remedaFromPairs,
  identity,
  isArray,
  isNumber,
  sort,
} from "remeda";
import { Candle, CandleSeries, Order } from "../core/types";
import { SizelessOrder } from "../high-level-api/types";
import { Dictionary } from "./type-util";

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

export function getExpectedFillPriceWithoutSlippage(
  order: Order | SizelessOrder,
  currentPrice: number | Candle | CandleSeries
): number {
  if (order.type === "market") {
    return isNumber(currentPrice)
      ? currentPrice
      : isArray(currentPrice)
      ? last(currentPrice).close
      : currentPrice.close;
  }
  return order.price;
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

/**
 * Filters object entries by the given predicate.
 *
 * Lodash's pickBy curried and with better typing.
 */
export const pickBy =
  <T>(predicate: (value: T, key: string) => boolean) =>
  (obj: Dictionary<T>): Dictionary<T> =>
    _.pickBy(obj, predicate);

/**
 * Maps object values by the given function.
 *
 * Lodash's mapValues curried and with better typing.
 */
export const mapValues =
  <T, R>(mapper: (value: T, key: string) => R) =>
  (obj: Dictionary<T>): Dictionary<R> =>
    _.mapValues(obj, mapper);

/**
 * Enables using Promise.then in pipe without arrow functions.
 */
export const then =
  <T, R>(
    fn: ((arg: T) => Promise<R>) | ((arg: T) => R)
  ): ((arg: Promise<T>) => Promise<R>) =>
  (arg: Promise<T>) =>
    arg.then(fn);

/**
 * Enables using Promise.then for an array of promises in pipe without arrow
 * functions.
 */
export const thenAll =
  <T, R>(fn: (arg: T[]) => R): ((arg: Promise<T>[]) => Promise<R>) =>
  (arg: Promise<T>[]) =>
    Promise.all(arg).then(fn);

/**
 * Repeats the given function on the initialValue until the endCondition is
 * reached. This can be used instead of recursion when performance is an issue
 * because of missing tail call optimization.
 */
export const repeatUntil =
  <T>(fn: (arg: T) => T, endCondition: (arg: T) => boolean) =>
  (initialValue: T) => {
    let value = initialValue;
    while (!endCondition(value)) {
      value = fn(value);
    }
    return value;
  };

/**
 * Repeats the given function on the initialValue until the endCondition is
 * reached. This can be used instead of recursion when performance is an issue
 * because of missing tail call optimization.
 */
export const repeatUntilAsync =
  <T>(fn: (arg: T) => Promise<T>, endCondition: (arg: T) => boolean) =>
  async (initialValue: T) => {
    let value = initialValue;
    while (!endCondition(value)) {
      value = await fn(value);
    }
    return value;
  };
