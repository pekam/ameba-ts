import { backtestStrategy } from "../core/backtest";
import {
  CandleSeries,
  Strategy,
  StrategyUpdate,
  TradeState,
} from "../core/types";
import { cancelEntry } from "./strat-util";

/**
 * Trades with the provided strategy only if it was profitable
 * in the near past.
 *
 * @param stratProvider
 * provider for the strategy to use
 * @param backtestInterval
 * how many candles between the backtest runs and thus
 * updating the condition to execute the strategy
 * @param backtestCandleCount
 * how many candles to include in the re-optimizing backtest
 * @param resultThreshold
 * the min profit the strategy should have generated in the backtest
 * to enable executing the strategy
 */
export function tradeOnlyRecentlyProfitable(
  stratProvider: () => Strategy,
  backtestInterval = 100,
  backtestCandleCount = 100,
  resultThreshold = 1.005
) {
  const strat: Strategy = stratProvider();

  let enabled = false;

  function updateEnabled(series: CandleSeries) {
    if (
      series.length % backtestInterval === 0 &&
      series.length >= backtestCandleCount
    ) {
      const backtestResult = backtestStrategy(
        stratProvider,
        series.slice(-backtestCandleCount),
        false
      );
      enabled = backtestResult.stats.result > resultThreshold;
    }
  }

  return function (state: TradeState): StrategyUpdate {
    updateEnabled(state.series);

    // Need to update indicators in all cases
    const update = strat(state);

    if (!state.position && !enabled) {
      // Not allowed to enter a trade
      return cancelEntry;
    } else {
      return update;
    }
  };
}
