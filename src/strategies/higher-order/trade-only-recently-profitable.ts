import {
  allInStaker,
  AssetState,
  backtestSync,
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
 * @param strategy the strategy to use
 * @param backtestInterval how long period between the backtest runs and thus
 * updating the condition to execute the strategy
 * @param backtestCandleCount how many candles to include in the re-optimizing
 * backtest
 * @param profitThreshold the min relative profit the strategy should have
 * generated in the backtest to enable executing the strategy, e.g. 0.01 for 1%
 * profit
 */
export function tradeOnlyRecentlyProfitable(
  strategy: TradingStrategy,
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
        };

    if (
      time - stratData.lastBacktested >= backtestInterval &&
      series.length >= backtestCandleCount
    ) {
      const backtestResult = backtestSync({
        strategy: withStaker(strategy, allInStaker),
        series: { _: series.slice(-backtestCandleCount) },
        progressHandler: null,
      });
      return {
        ...state,
        torpData: {
          enabled: backtestResult.stats.relativeProfit > profitThreshold,
          lastBacktested: time,
        },
      };
    }

    return { ...state, torpData: stratData };
  }

  return function (state: AssetState): StrategyUpdate {
    const data = getAssetData(state);

    const update = (() => {
      if (!state.position && !data.torpData.enabled) {
        // Not allowed to enter a trade
        return cancelEntry;
      } else {
        return strategy(state);
      }
    })();

    return { ...update, data: { ...(update.data || {}), ...data } };
  };
}

interface TORPData {
  enabled: boolean;
  lastBacktested: number;
}

type HasTORPData = Dictionary<any> & {
  torpData: TORPData;
};
