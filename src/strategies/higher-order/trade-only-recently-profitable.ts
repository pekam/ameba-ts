import {
  allInStaker,
  AssetState,
  backtest,
  cancelEntry,
  StrategyUpdate,
  TradingStrategy,
  withStaker,
} from "../..";
import { Dictionary } from "../../util/type-util";
import { last } from "../../util/util";

// TODO This is a special case of autoOptimizer. Could be just deleted or at
// least use autoOptimizer internally. Also this has not been tested after major
// revamps.

/**
 * Trades with the provided strategy only if it was profitable in the near past.
 *
 * NOTE: Staking is based on cash balance which might cause unexpected behavior
 * if used with the multi-asset backtester, especially when having short
 * positions on other assets.
 *
 * @param stratProvider provider for the strategy to use
 * @param backtestInterval how long period between the backtest runs and thus
 * updating the condition to execute the strategy
 * @param backtestCandleCount how many candles to include in the re-optimizing
 * backtest
 * @param profitThreshold the min relative profit the strategy should have
 * generated in the backtest to enable executing the strategy, e.g. 0.01 for 1%
 * profit
 */
export function tradeOnlyRecentlyProfitable(
  stratProvider: () => TradingStrategy,
  backtestInterval: number,
  backtestCandleCount = 100,
  profitThreshold = 0.005
) {
  function getAssetData(state: AssetState): HasTORPData {
    function hasStratData(data: any): data is HasTORPData {
      return !!(data as HasTORPData).torpData;
    }

    const series = state.series;
    const time = last(series).time;

    const stratData: TORPData = hasStratData(state.data)
      ? state.data.torpData
      : {
          enabled: false,
          lastBacktested: 0,
          strat: stratProvider(),
        };

    if (
      time - stratData.lastBacktested >= backtestInterval &&
      series.length >= backtestCandleCount
    ) {
      const backtestResult = backtest({
        strategy: withStaker(stratProvider, allInStaker),
        series: { _: series.slice(-backtestCandleCount) },
        progressHandler: null,
      });
      return {
        ...state,
        torpData: {
          enabled: backtestResult.stats.relativeProfit > profitThreshold,
          lastBacktested: time,
          strat: stratData.strat,
        },
      };
    }

    return { ...state, torpData: stratData };
  }

  return function (state: AssetState): StrategyUpdate {
    const data = getAssetData(state);

    const update = (() => {
      // Update indicators etc. in all cases
      const update = data.torpData.strat(state);

      if (!state.position && !data.torpData.enabled) {
        // Not allowed to enter a trade
        return cancelEntry;
      } else {
        return update;
      }
    })();

    return { ...update, data: { ...(update.data || {}), ...data } };
  };
}

interface TORPData {
  enabled: boolean;
  lastBacktested: number;
  strat: TradingStrategy;
}

type HasTORPData = Dictionary<any> & {
  torpData: TORPData;
};
