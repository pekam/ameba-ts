import { MarketPosition, StrategyUpdate, TradeState } from "../core/types";
import { m } from "../shared/functions";
import { cancelEntry, nonIncresingStopLoss } from "./strat-util";

/**
 * (needs a better name...)
 * Enters when there's a big one-directional move relative to the
 * current volatility (average range/candlesize).
 */
export function volatilityStrategy(settings: {
  period: number;
  onlyDirection?: MarketPosition;
}) {
  return function (state: TradeState): StrategyUpdate {
    const series = state.series;

    const avgRangePeriod = 20;
    const avgSize = m.getAverageCandleSize(series, avgRangePeriod);

    if (!state.position) {
      if (series.length < avgRangePeriod) {
        return {};
      }

      const period = settings.period;

      const recentDiff =
        m.last(series).close - m.get(series, -(period + 1)).close;

      const longCondition = recentDiff > period * avgSize;
      const shortCondition = recentDiff < 0 - period * avgSize;

      if (longCondition && settings.onlyDirection !== "short") {
        const entryPrice = m.combine(series.slice(-(period + 1))).high;
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
        const entryPrice = m.combine(series.slice(-(period + 1))).low;
        return {
          entryOrder: {
            type: "stop",
            price: entryPrice,
            side: "sell",
          },
          stopLoss: entryPrice + avgSize * 2,
        };
      }

      return cancelEntry;
    } else {
      return nonIncresingStopLoss({
        state,
        stopLossValue: avgSize * 2,
        stopLossType: "diff",
      });
    }
  };
}
