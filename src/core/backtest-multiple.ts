import { Strategy } from "./types";
import { CandleSeries } from "./candle-series";
import { backtestStrategy } from "./backtest";
import { combineResults } from "./backtest-result";

/**
 * Tests the given strategy on multiple candle series and returns
 * the combined result.
 */
export function backtestMultiple(
  stratProvider: () => Strategy,
  multiSeries: CandleSeries[]
) {
  const results = multiSeries.map((series) =>
    backtestStrategy(stratProvider, series)
  );
  return combineResults(results, multiSeries);
}
