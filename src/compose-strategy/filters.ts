import { isDefined, isNumber } from "remeda";
import {
  AssetPredicate,
  AssetState,
  ValueProvider,
  timeIsAfterOrEqual,
  timeIsBefore,
  toNewYorkTime,
} from "..";
import { last } from "../util/util";

/**
 * An entry filter that passes if the first provided value is greater than the
 * second.
 */
export function gt(
  valueProvider1: ValueProvider | number,
  valueProvider2: ValueProvider | number
): AssetPredicate {
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
): AssetPredicate {
  return (state) => {
    const value1 = getValue(valueProvider1, state);
    const value2 = getValue(valueProvider2, state);
    return isDefined(value1) && isDefined(value2) && value1 < value2;
  };
}

function getValue(
  providerOrValue: ValueProvider | number,
  state: AssetState
): number | undefined {
  return isNumber(providerOrValue) ? providerOrValue : providerOrValue(state);
}

/**
 * An entry filter that passes if the time in New York is the same or later than
 * the given hour and minute.
 */
export function newYorkTimeAfterOrEqual(
  hour: number,
  minute?: number
): AssetPredicate {
  return (state) =>
    timeIsAfterOrEqual(toNewYorkTime(last(state.series).time), hour, minute);
}

/**
 * An entry filter that passes if the time in New York is before the given hour
 * and minute.
 */
export function newYorkTimeBefore(
  hour: number,
  minute?: number
): AssetPredicate {
  return (state) =>
    timeIsBefore(toNewYorkTime(last(state.series).time), hour, minute);
}
