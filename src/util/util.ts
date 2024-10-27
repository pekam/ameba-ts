import {
  identity,
  isArray,
  isNumber,
  maxBy,
  minBy,
  purry,
  fromPairs as remedaFromPairs,
  pickBy as remedaPickBy,
  sort,
  sumBy,
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
export const sum = sumBy<number>(identity);
export const min = minBy<number>(identity);
export const max = maxBy<number>(identity);

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
  currentPriceSource: number | Candle | CandleSeries
): number {
  const currentPrice = isNumber(currentPriceSource)
    ? currentPriceSource
    : isArray(currentPriceSource)
    ? last(currentPriceSource).close
    : currentPriceSource.close;

  // Need to check market order here also for TS to know that it's definitely
  // limit or stop order in the else-block.
  if (order.type === "market" || shouldFillImmediately(order, currentPrice)) {
    return currentPrice;
  } else {
    return order.price;
  }
}

export function shouldFillImmediately(
  order: Order | SizelessOrder,
  currentPrice: number
): boolean {
  if (order.type === "market") {
    return true;
  }
  const { type, price: orderPrice, side } = order;
  if (side === "buy") {
    if (type === "limit") {
      return currentPrice <= orderPrice;
    } else if (type === "stop") {
      return currentPrice >= orderPrice;
    }
  } else if (side === "sell") {
    if (type === "limit") {
      return currentPrice >= orderPrice;
    } else if (type === "stop") {
      return currentPrice <= orderPrice;
    }
  }
  // TODO why doesn't TS recognize the exhaustiveness above?
  throw Error(
    "Unhandled order side+type combo " + JSON.stringify({ side, type })
  );
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
 * Remeda's pickBy with looser typing.
 */
export const pickBy =
  <T>(predicate: (value: T, key: string) => boolean) =>
  (obj: Dictionary<T>): Dictionary<T> =>
    remedaPickBy(obj, predicate);

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

export function tap<T>(value: T, fn: (value: T) => void): T;
export function tap<T>(fn: (value: T) => void): (value: T) => T;
export function tap() {
  return purry(_tap, arguments);
}
function _tap<T>(value: T, fn: (value: T) => void): T {
  fn(value);
  return value;
}

export function takeLastWhile<T>(
  array: ReadonlyArray<T>,
  fn: (item: T) => boolean
): Array<T>;
export function takeLastWhile<T>(
  fn: (item: T) => boolean
): (array: ReadonlyArray<T>) => Array<T>;
export function takeLastWhile() {
  return purry(_takeLastWhile, arguments);
}
export function _takeLastWhile<T>(
  array: ReadonlyArray<T>,
  fn: (item: T) => boolean
): ReadonlyArray<T> {
  for (let i = array.length - 1; i >= 0; i--) {
    if (!fn(array[i])) {
      return array.slice(i + 1);
    }
  }
  return array;
}

export function dropWhile<T>(
  array: ReadonlyArray<T>,
  fn: (item: T) => boolean
): Array<T>;
export function dropWhile<T>(
  fn: (item: T) => boolean
): (array: ReadonlyArray<T>) => Array<T>;
export function dropWhile() {
  return purry(_dropWhile, arguments);
}
export function _dropWhile<T>(
  array: ReadonlyArray<T>,
  fn: (item: T) => boolean
): ReadonlyArray<T> {
  for (let i = 0; i < array.length; i++) {
    if (!fn(array[i])) {
      return array.slice(i);
    }
  }
  return [];
}

export function dropLastWhile<T>(
  array: ReadonlyArray<T>,
  fn: (item: T) => boolean
): Array<T>;
export function dropLastWhile<T>(
  fn: (item: T) => boolean
): (array: ReadonlyArray<T>) => Array<T>;
export function dropLastWhile() {
  return purry(_dropLastWhile, arguments);
}
export function _dropLastWhile<T>(
  array: ReadonlyArray<T>,
  fn: (item: T) => boolean
): ReadonlyArray<T> {
  for (let i = array.length - 1; i >= 0; i--) {
    if (!fn(array[i])) {
      return array.slice(0, i + 1);
    }
  }
  return [];
}
