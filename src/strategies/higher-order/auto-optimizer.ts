import { maxBy } from "lodash";
import {
  allInStaker,
  AssetState,
  backtestSync,
  TradingStrategy,
  withStaker,
} from "../..";
import { Dictionary } from "../../util/type-util";
import { last } from "../../util/util";

/**
 * Periodically backtests all the strategies in the pool and uses the most
 * profitable one.
 */
export function autoOptimizer(settings: {
  stratPool: TradingStrategy[];
  optimizeInterval: number;
  optimizePeriod: number;
}): TradingStrategy {
  function optimize({ series }: AssetState): TradingStrategy {
    const withProfits = settings.stratPool.map((strategy) => {
      const from = last(series).time - settings.optimizePeriod;
      const result = backtestSync({
        strategy: withStaker(strategy, allInStaker),
        series: { _: series.slice(-10000) },
        progressHandler: null,
        from,
      });

      return { strategy, profit: result.stats.relativeProfit };
    });

    const best = maxBy(withProfits, (w) => w.profit);
    if (!best || best.profit <= 0) {
      return noopStrategy;
    } else {
      return best.strategy;
    }
  }

  function getAssetData(state: AssetState): HasAutoOptimizerStratData {
    const time = last(state.series).time;
    const seriesLength = time - state.series[0].time;

    function hasStratData(data: any): data is HasAutoOptimizerStratData {
      return !!(data as HasAutoOptimizerStratData).autoOptimizerData;
    }

    const stratData: AutoOptimizerStratData = hasStratData(state.data)
      ? state.data.autoOptimizerData
      : {
          currentStrategy: noopStrategy,
          lastOptimized: 0,
        };

    if (
      seriesLength > settings.optimizePeriod &&
      !state.position &&
      time >= stratData.lastOptimized + settings.optimizeInterval
    ) {
      return {
        ...state.data,
        autoOptimizerData: {
          currentStrategy: optimize(state),
          lastOptimized: time,
        },
      };
    }

    return {
      ...state.data,
      autoOptimizerData: stratData,
    };
  }

  return (state: AssetState) => {
    const data = getAssetData(state);

    const update = data.autoOptimizerData.currentStrategy(state);

    return { ...update, data: { ...(update.data || {}), ...data } };
  };
}

interface AutoOptimizerStratData {
  currentStrategy: TradingStrategy;
  lastOptimized: number;
}

type HasAutoOptimizerStratData = Dictionary<any> & {
  autoOptimizerData: AutoOptimizerStratData;
};

const noopStrategy: TradingStrategy = () => ({
  entryOrder: null,
  takeProfit: null,
  stopLoss: null,
});
