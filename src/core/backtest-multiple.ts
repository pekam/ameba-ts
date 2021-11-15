import { startProgressBar } from "../util";
import { backtestStrategy } from "./backtest";
import { combineResults } from "./backtest-result";
import { CandleSeries, Strategy } from "./types";

/**
 * Tests the given strategy on multiple candle series and returns
 * the combined result.
 */
export function backtestMultiple(args: {
  stratProvider: () => Strategy;
  multiSeries: CandleSeries[];
  showProgressBar?: boolean;
}) {
  const defaults = { showProgressBar: true };
  const { stratProvider, multiSeries, showProgressBar } = {
    ...defaults,
    ...args,
  };
  const progressBar = startProgressBar(multiSeries.length, showProgressBar);
  const results = multiSeries.map((series) => {
    const result = backtestStrategy({
      stratProvider,
      series,
      showProgressBar: false,
    });
    progressBar.increment();
    return result;
  });
  progressBar.stop();
  return combineResults(results, multiSeries);
}
