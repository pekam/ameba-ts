import { maxBy } from "lodash";
import {
  allInStaker,
  AssetState,
  backtest,
  TradingStrategy,
  withStaker,
} from "../..";
import { last } from "../../util/util";

const relativeTransactionCost = 0.0007;

/**
 * Periodically backtests all the strategies in the pool and uses the most
 * profitable one.
 */
export function autoOptimizer(settings: {
  stratPool: (() => TradingStrategy)[];
  optimizeInterval: number;
  optimizePeriod: number;
}): TradingStrategy {
  let currentStrategy: TradingStrategy = noopStrategy;
  let lastOptimizedTimestamp: number = 0;

  function optimize({ series }: AssetState): TradingStrategy {
    const withProfits = settings.stratPool.map((stratProvider) => {
      const from = last(series).time - settings.optimizePeriod;
      const result = backtest({
        strategy: withStaker(stratProvider, allInStaker),
        series: { _: series.slice(-10000) },
        progressHandler: null,
        from,
      });
      // const withTransactionCost = withRelativeTransactionCost(
      //   result,
      //   relativeTransactionCost
      // );

      return { stratProvider, profit: result.stats.relativeProfit };
    });

    const best = maxBy(withProfits, (w) => w.profit);
    if (!best || best.profit <= 0) {
      return noopStrategy;
    } else {
      return best.stratProvider();
    }
  }

  return (state: AssetState) => {
    const time = last(state.series).time;

    const seriesLength = time - state.series[0].time;

    if (
      seriesLength > settings.optimizePeriod &&
      !state.position &&
      time >= lastOptimizedTimestamp + settings.optimizeInterval
    ) {
      currentStrategy = optimize(state);
      lastOptimizedTimestamp = time;
    }

    return currentStrategy(state);
  };
}

const noopStrategy: TradingStrategy = () => ({
  entryOrder: null,
  takeProfit: null,
  stopLoss: null,
});
