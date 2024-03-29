import { AssetState } from "../core/types";
import { StrategyUpdate } from "../high-level-api/types";
import { combineCandles, get, getAverageCandleSize, last } from "../util/util";
import { cancelOrders, nonIncresingStopLoss } from "./strat-util";

/**
 * (needs a better name...) Enters when there's a big one-directional move
 * relative to the current volatility (average range/candlesize).
 */
export function volatilityStrategy(settings: {
  period: number;
  onlyDirection?: "long" | "short";
}) {
  return function (state: AssetState): StrategyUpdate {
    const series = state.series;

    const avgRangePeriod = 20;
    const avgSize = getAverageCandleSize(series, avgRangePeriod);

    if (!state.position) {
      if (series.length < avgRangePeriod) {
        return {};
      }

      const period = settings.period;

      const recentDiff = last(series).close - get(series, -(period + 1)).close;

      const longCondition = recentDiff > period * avgSize;
      const shortCondition = recentDiff < 0 - period * avgSize;

      if (longCondition && settings.onlyDirection !== "short") {
        const entryPrice = combineCandles(series.slice(-(period + 1))).high;
        return {
          entryOrder: {
            type: "stop",
            price: entryPrice,
            side: "buy",
          },
          stopLoss: entryPrice - avgSize * 2,
        };
      }

      if (shortCondition && settings.onlyDirection !== "long") {
        const entryPrice = combineCandles(series.slice(-(period + 1))).low;
        return {
          entryOrder: {
            type: "stop",
            price: entryPrice,
            side: "sell",
          },
          stopLoss: entryPrice + avgSize * 2,
        };
      }

      return cancelOrders;
    } else {
      return nonIncresingStopLoss({
        state,
        stopLossValue: avgSize * 2,
        stopLossType: "diff",
      });
    }
  };
}
