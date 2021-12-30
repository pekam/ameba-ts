import { Candle } from "../core/types";
import { IndicatorValues, PredicateCounterSettings } from "./indicators";

/**
 * Returns a function that is expected to be called with candles of a series in
 * order and without gaps. It returns the indicator value the provided candle.
 *
 * The implementation is stateful for performance.
 */
export function getPredicateCounter({
  period,
  predicate,
}: PredicateCounterSettings) {
  if (period < 1) {
    throw Error("Period must be >=1");
  }
  const results: boolean[] = [];
  let counter = 0;

  return (candle: Candle, indicatorValues: IndicatorValues) => {
    const result = predicate(candle, indicatorValues);
    results.push(result);
    if (result) {
      counter++;
    }
    if (results.length > period) {
      const removed = results.shift();
      if (removed) {
        counter--;
      }
    }
    if (results.length !== period) {
      return undefined;
    }
    return counter / period;
  };
}
