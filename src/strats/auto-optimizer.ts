import _ from "lodash";
import { backtestStrategy } from "../core/backtest";
import { Strategy, TradeState } from "../core/types";
import { m } from "../shared/functions";

const relativeTransactionCost = 0.0007;

/**
 * Periodically backtests all the strategies in the pool and uses the most
 * profitable one.
 */
export function autoOptimizer(settings: {
  stratPool: (() => Strategy)[];
  optimizeInterval: number;
  optimizePeriod: number;
}): Strategy {
  let currentStrategy: Strategy = noopStrategy;
  let lastOptimizedTimestamp: number = 0;

  function optimize({ series }: TradeState): Strategy {
    const withProfits = settings.stratPool.map((stratProvider) => {
      const from = m.last(series).time - settings.optimizePeriod;
      const result = backtestStrategy({
        stratProvider,
        series: series.slice(-10000),
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

  return (state: TradeState) => {
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

const noopStrategy: Strategy = () => ({
  entryOrder: null,
  takeProfit: null,
  stopLoss: null,
});
