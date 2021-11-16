import { Order, StrategyUpdate, TradeState } from "../core/types";
import { m } from "../shared/functions";
import { findRSIDivergences } from "./rsi-divergence";
import { trailingLowExit } from "./trailing-low-exit";

export function rsiDivergenceStrategy() {
  return function (state: TradeState): StrategyUpdate {
    const series = state.series;

    if (!state.position) {
      if (series.length < 3) {
        return {};
      }
      if (state.entryOrder) {
        // TODO: what if entry doesn't trigger
        return {};
      }
      // Could be optimized to find only the latest divergence
      const rsiDivergences = findRSIDivergences(series, 14);
      const olderCandle = m.get(series, -2);

      const isRSIDivergence = rsiDivergences.find(
        (rsiDivCandle) => rsiDivCandle.time === olderCandle.time
      );
      if (isRSIDivergence) {
        const lastCandle = m.last(state.series);
        const candleSize = lastCandle.high - lastCandle.low;
        const limitPrice = lastCandle.high + candleSize;

        const { stopLoss } = trailingLowExit(state);
        const entryOrder: Order = {
          price: limitPrice,
          type: "limit",
          side: "buy",
          size: state.cash / limitPrice,
        };
        return {
          entryOrder,
          stopLoss: stopLoss || lastCandle.low - candleSize,
        };
      }
    } else {
      return trailingLowExit(state);
    }

    return {};
  };
}
