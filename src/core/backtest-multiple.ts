import { CandleSeries, Strategy } from "./types";
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
    const result = backtestStrategy(stratProvider, series, false);
    progressBar.increment();
    return result;
  });
  progressBar.stop();
  return combineResults(results, multiSeries);
}
