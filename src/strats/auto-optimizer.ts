import _ from "lodash";
import { backtestStrategy } from "../core/backtest";
import { withRelativeTransactionCost } from "../core/backtest-result";
import { Strategy, StrategyUpdate, TradeState } from "../core/types";
import { m } from "../shared/functions";

const relativeTransactionCost = 0.0007;

/**
 * Periodically backtests all the strategies in the pool and uses the most
 * profitable one.
 */
export class AutoOptimizer implements Strategy {
  private currentStrategy: Strategy = noopStrategy;
  private lastOptimizedTimestamp: number = 0;

  constructor(
    private settings: {
      stratPool: (() => Strategy)[];
      optimizeInterval: number;
      optimizePeriod: number;
    }
  ) {}

  update(state: TradeState): StrategyUpdate {
    const time = m.last(state.series).time;

    const seriesLength = time - state.series[0].time;

    if (
      seriesLength > this.settings.optimizePeriod &&
      !state.position &&
      time >= this.lastOptimizedTimestamp + this.settings.optimizeInterval
    ) {
      this.currentStrategy = this.optimize(state);
      this.lastOptimizedTimestamp = time;
    }

    return this.currentStrategy.update(state);
  }

  private optimize({ series }: TradeState): Strategy {
    const withProfits = this.settings.stratPool.map((stratProvider) => {
      const from = m.last(series).time - this.settings.optimizePeriod;
      const result = backtestStrategy(
        stratProvider,
        series.slice(-10000),
        false,
        from
      );
      const withTransactionCost = withRelativeTransactionCost(
        result,
        relativeTransactionCost
      );

      return { stratProvider, profit: withTransactionCost.stats.profit };
    });

    const best = _.maxBy(withProfits, (w) => w.profit);
    if (!best || best.profit <= 0) {
      return noopStrategy;
    } else {
      return best.stratProvider();
    }
  }
}

const noopStrategy: Strategy = {
  update: () => ({
    entryOrder: null,
    takeProfit: null,
    stopLoss: null,
  }),
};
