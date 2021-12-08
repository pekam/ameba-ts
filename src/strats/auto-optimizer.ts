import _ from "lodash";
import { AssetState, backtest } from "../core/backtest";
import { allInStaker, SizelessStrategy, withStaker } from "../core/staker";
import { m } from "../shared/functions";

const relativeTransactionCost = 0.0007;

/**
 * Periodically backtests all the strategies in the pool and uses the most
 * profitable one.
 */
export function autoOptimizer(settings: {
  stratPool: (() => SizelessStrategy)[];
  optimizeInterval: number;
  optimizePeriod: number;
}): SizelessStrategy {
  let currentStrategy: SizelessStrategy = noopStrategy;
  let lastOptimizedTimestamp: number = 0;

  function optimize({ series }: AssetState): SizelessStrategy {
    const withProfits = settings.stratPool.map((stratProvider) => {
      const from = m.last(series).time - settings.optimizePeriod;
      const result = backtest({
        stratProvider: () => withStaker(stratProvider, allInStaker),
        series: { _: series.slice(-10000) },
        showProgressBar: false,
        from,
      });
      // const withTransactionCost = withRelativeTransactionCost(
      //   result,
      //   relativeTransactionCost
      // );

      return { stratProvider, profit: result.stats.relativeProfit };
    });

    const best = _.maxBy(withProfits, (w) => w.profit);
    if (!best || best.profit <= 0) {
      return noopStrategy;
    } else {
      return best.stratProvider();
    }
  }

  return (state: AssetState) => {
    const time = m.last(state.series).time;

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

const noopStrategy: SizelessStrategy = () => ({
  entryOrder: null,
  takeProfit: null,
  stopLoss: null,
});
