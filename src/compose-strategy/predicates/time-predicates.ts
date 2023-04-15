import {
  AssetPredicate,
  timeIsAfterOrEqual,
  timeIsBefore,
  toNewYorkTime,
} from "../..";
import { last } from "../../util/util";

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
