import { AssetState, backtest } from "../core/backtest";
import {
  allInStaker,
  TradingStrategy,
  StrategyUpdate,
  withStaker,
} from "../core/staker";
import { CandleSeries } from "../core/types";
import { cancelEntry } from "./strat-util";

/**
 * Trades with the provided strategy only if it was profitable in the near past.
 *
 * NOTE: Staking is based on cash balance which might cause unexpected behavior
 * if used with the multi-asset backtester, especially when having short
 * positions on other assets.
 *
 * @param stratProvider provider for the strategy to use
 * @param backtestInterval how many candles between the backtest runs and thus
 * updating the condition to execute the strategy
 * @param backtestCandleCount how many candles to include in the re-optimizing
 * backtest
 * @param profitThreshold the min relative profit the strategy should have
 * generated in the backtest to enable executing the strategy, e.g. 0.01 for 1%
 * profit
 */
export function tradeOnlyRecentlyProfitable(
  stratProvider: () => TradingStrategy,
  backtestInterval = 100,
  backtestCandleCount = 100,
  profitThreshold = 0.005
) {
  const strat: TradingStrategy = stratProvider();

  let enabled = false;

  function updateEnabled(series: CandleSeries) {
    if (
      series.length % backtestInterval === 0 &&
      series.length >= backtestCandleCount
    ) {
      const backtestResult = backtest({
        stratProvider: () => withStaker(stratProvider, allInStaker),
        series: { _: series.slice(-backtestCandleCount) },
        showProgressBar: false,
      });
      enabled = backtestResult.stats.relativeProfit > profitThreshold;
    }
  }

  return function (state: AssetState): StrategyUpdate {
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
