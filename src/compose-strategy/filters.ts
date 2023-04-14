import { isDefined, isNumber } from "remeda";
import {
  AssetState,
  getAdx,
  getDonchianChannel,
  getSma,
  timeIsAfterOrEqual,
  timeIsBefore,
  toNewYorkTime,
} from "..";
import { last } from "../util/util";
import { EntryFilter } from "./compose-strategy";

/**
 * An entry filter that passes if the first provided value is greater than the
 * second.
 */
export function gt(
  valueProvider1: ValueProvider | number,
  valueProvider2: ValueProvider | number
): EntryFilter {
  return (state) => {
    const value1 = getValue(valueProvider1, state);
    const value2 = getValue(valueProvider2, state);
    return isDefined(value1) && isDefined(value2) && value1 > value2;
  };
}

/**
 * An entry filter that passes if the first provided value is less than the
 * second.
 */
export function lt(
  valueProvider1: ValueProvider | number,
  valueProvider2: ValueProvider | number
): EntryFilter {
  return (state) => {
    const value1 = getValue(valueProvider1, state);
    const value2 = getValue(valueProvider2, state);
    return isDefined(value1) && isDefined(value2) && value1 < value2;
  };
}

/**
 * A function that gets a numeric value (usually the value of some technical
 * indicator) so it can be used with entry filters such as {@link gt}.
 */
export type ValueProvider = (state: AssetState) => number | undefined;

function getValue(
  providerOrValue: ValueProvider | number,
  state: AssetState
): number | undefined {
  return isNumber(providerOrValue) ? providerOrValue : providerOrValue(state);
}

/**
 * The simple moving average indicator as a {@link ValueProvider}.
 */
export const sma =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state: AssetState) =>
    getSma(state, period, indexFromEnd);

/**
 * The average directional index indicator as a {@link ValueProvider}.
 */
export const adx =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state: AssetState) =>
    getAdx(state, period, indexFromEnd)?.adx;

/**
 * A {@link ValueProvider} that returns the max price reached in the last
 * 'period' candles.
 */
export const trailingHigh =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state: AssetState) =>
    getDonchianChannel(state, period, indexFromEnd)?.upper;

/**
 * A {@link ValueProvider} that returns the min price reached in the last
 * 'period' candles.
 */
export const trailingLow =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state: AssetState) =>
    getDonchianChannel(state, period, indexFromEnd)?.lower;

/**
 * An entry filter that passes if the time in New York is the same or later than
 * the given hour and minute.
 */
export function newYorkTimeAfterOrEqual(
  hour: number,
  minute?: number
): EntryFilter {
  return (state) =>
    timeIsAfterOrEqual(toNewYorkTime(last(state.series).time), hour, minute);
}

/**
 * An entry filter that passes if the time in New York is before the given hour
 * and minute.
 */
export function newYorkTimeBefore(hour: number, minute?: number): EntryFilter {
  return (state) =>
    timeIsBefore(toNewYorkTime(last(state.series).time), hour, minute);
}
