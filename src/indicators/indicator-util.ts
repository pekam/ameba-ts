import { Candle } from "../core/types";
import { Dictionary } from "../util/type-util";
import { getIndicatorValue, SeriesAndData } from "./indicator";

export interface IndicatorChannel {
  upper: number;
  middle: number;
  lower: number;
}

/**
 * Shorthand for creating an indicator getter API, when the indicator has one
 * parameter `period: number`.
 */
export function createIndicatorWithPeriod<RESULT>(
  keyPrefix: string,
  initializer: (period: number) => (c: Candle) => RESULT | undefined
) {
  return (state: SeriesAndData, period: number, indexFromEnd: number = 0) =>
    getIndicatorValue(
      state,
      `${keyPrefix}_${period}`,
      () => initializer(period),
      indexFromEnd
    );
}

/**
 * Shorthand for creating an indicator getter API, when the indicator has
 * multiple arguments wrapped in a `settings` object.
 */
export function createIndicatorWithSettings<SETTINGS, RESULT>(
  keyPrefix: string,
  initializer: (settings: SETTINGS) => (c: Candle) => RESULT | undefined
) {
  return (state: SeriesAndData, settings: SETTINGS, indexFromEnd: number = 0) =>
    getIndicatorValue(
      state,
      `${keyPrefix}_${settingsToString(settings)}`,
      () => initializer(settings),
      indexFromEnd
    );
}

function settingsToString(settings: Dictionary<any>) {
  return Object.values(settings).join("_");
}
