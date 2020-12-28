import { Order, Strategy, TradeState } from "../core/types";
import { findRSIDivergences } from "./rsi-divergence";
import { trailingLowExit } from "./trailing-low-exit";
import { m } from "../functions/functions";

export class RsiDivergenceStrategy implements Strategy {
  init(tradeState: TradeState): void {}

  update(
    state: TradeState
  ): {
    entryOrder?: Order;
    stopLoss?: number;
    takeProfit?: number;
  } {
    const series = state.series;

    if (!state.position) {
      if (series.length < 3) {
        return;
      }
      if (state.entryOrder) {
        // TODO: what if entry doesn't trigger
        return;
      }
      // Could be optimized to find only the latest divergence
      const rsiDivergences = findRSIDivergences(series, 14);
      const olderCandle = series[series.length - 2];

      const isRSIDivergence = rsiDivergences.find(
        (rsiDivCandle) => rsiDivCandle.time === olderCandle.time
      );
      if (isRSIDivergence) {
        const lastCandle = m.last(state.series);
        const candleSize = lastCandle.high - lastCandle.low;
        const limitPrice = lastCandle.high + candleSize;

        const { stopLoss } = trailingLowExit(state);
        return {
          entryOrder: { price: limitPrice, type: "limit" },
          stopLoss: stopLoss || lastCandle.low - candleSize,
        };
      }
    } else {
      return trailingLowExit(state);
    }
  }
}
