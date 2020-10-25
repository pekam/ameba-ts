import { Strategy } from "./types";
import { CandleSeries } from "./candle-series";
import { backtestStrategy } from "./backtest";
import { combineResults } from "./backtest-result";
import { startProgressBar } from "../util";

/**
 * Tests the given strategy on multiple candle series and returns
 * the combined result.
 */
export function backtestMultiple(
  stratProvider: () => Strategy,
  multiSeries: CandleSeries[],
  showProgressBar = true
) {
  const progressBar = startProgressBar(multiSeries.length, showProgressBar);
  const results = multiSeries.map((series) => {
    progressBar.increment();
    return backtestStrategy(stratProvider, series, false);
  });
  progressBar.stop();
  return combineResults(results, multiSeries);
}
