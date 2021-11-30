import { Moment } from "../shared/time-util";
import {
  backtestMultiple,
  MultiAssetStrategy,
  MultiAssetTradeState,
} from "./backtest-multiple";
import { BacktestResult } from "./backtest-result";
import { CandleSeries, Strategy } from "./types";

const usedStrats = new WeakSet<Strategy>();

/**
 * Tests how the given strategy would have performed with
 * the provided historical price data.
 *
 * @param stratProvider the provider for the strategy to test
 * @param series data series covering at least the range
 * between 'from' and 'to' arguments, plus X time before
 * to have some history for the first values
 * @param from the start of the time range to test
 * as unix timestamp, inclusive
 * @param to the end of the time range to test
 * as unix timestamp, inclusive, can be dismissed
 * to test until the end of the series
 */
export function backtestStrategy(args: {
  stratProvider: () => Strategy;
  series: CandleSeries;
  initialBalance?: number;
  showProgressBar?: boolean;
  from?: Moment;
  to?: Moment;
}): BacktestResult {
  // Strategies are stateful, which is why a new instance is needed for each backtest.
  const strat: Strategy = args.stratProvider();
  if (usedStrats.has(strat)) {
    // In case the stratProvider returns the same instance many times.
    throw Error(
      "This strategy instance has been backtested already. " +
        "Strategies are often stateful, so backtesting a strategy " +
        "multiple times would cause problems in most cases."
    );
  }
  usedStrats.add(strat);

  // Backtesting a strategy with a single asset is a sub-case of backtesting
  // with multiple assets, so it's best to convert the single-asset strat to
  // multi-asset and run it through the more powerful backtester, instead of
  // having specific implementations for each.
  const symbol = "asset"; // could be anything
  const multiStrat: MultiAssetStrategy = (multiState: MultiAssetTradeState) => [
    {
      ...strat({ ...multiState.assets[symbol], cash: multiState.cash }),
      symbol,
    },
  ];
  return backtestMultiple({
    ...args,
    stratProvider: () => multiStrat,
    multiSeries: { [symbol]: args.series },
  });
}
