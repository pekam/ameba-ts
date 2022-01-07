import { takeRightWhile } from "lodash";
import { AssetState, Candle, CandleSeries } from "../core/types";
import { Dictionary } from "../util/type-util";
import { last } from "../util/util";

/*
Note: While most of this project works with pure functions, the indicators
directly mutate the AssetState.data object. This needs some explanation.

The specs of the indicator APIs were:
- Convenient API to get indicator values in a strategy, e.g. getSma(state, 20)
- Good performance -> avoid calculating indicators from scratch in each
  iteration -> need to store the previous indicator values somewhere

The performance could be achieved with immutability by returning the previously
calculated indicators within the data-object, but the usage would be very
cumbersome.

Furthermore, the indicators are not very risky to be implemented this way,
because it doesn't matter how many times or in which order indicators are
fetched (the common reason for bugs in non-pure code), the value of a specific
indicator for a specific candle will always be the same.
*/

/**
 * Gets the value of an indicator, or `undefined` if there's not been enough
 * data to calculate the indicator yet.
 *
 * This should be used to build more convenient indicator-specific APIs.
 *
 * @param key unique identifier for this indicator. The same kind of indicator
 * with different parameters should have different keys.
 * @param initializer function which will be called once when this indicator
 * (identified by `key`) is asked for the first time. It should return a
 * function that generates the indicator value for the provided candle. This
 * generator will be called sequentially for each candle in the series.
 * @param indexFromEnd 0 to get the latest value, 1 for the second last etc.
 */
export function getIndicatorValue<RESULT>(
  state: AssetState,
  key: string,
  initializer: () => (c: Candle) => RESULT | undefined,
  indexFromEnd: number
): RESULT | undefined {
  const indicator = computeIfAbsent(getIndicatorStore(state), key, () =>
    createIndicator(initializer)
  );

  indicator.update(state.series);
  return indicator.getFromEnd(indexFromEnd);
}

function createIndicator<RESULT>(initializer: () => (c: Candle) => RESULT) {
  const nextValueGenerator = initializer();

  const result: RESULT[] = [];
  let lastTimestamp = -1;

  return {
    update: (series: CandleSeries): void => {
      takeRightWhile(series, (c) => c.time > lastTimestamp).forEach((c) => {
        const nextValue = nextValueGenerator(c);
        nextValue && result.push(nextValue);
      });
      lastTimestamp = Math.max(lastTimestamp, last(series).time);
    },

    getFromEnd: (index: number): RESULT | undefined => {
      return result[result.length - 1 - index];
    },
  };
}

function getIndicatorStore(state: AssetState): Dictionary<any> {
  return computeIfAbsent(state.data, "_indicators", () => ({}));
}

function computeIfAbsent<T>(
  obj: Dictionary<any>,
  key: string,
  initializer: () => T
): T {
  if (!obj[key]) {
    obj[key] = initializer();
  }
  return obj[key];
}
