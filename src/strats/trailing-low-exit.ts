import { StrategyUpdate, TradeState } from "../core/types";
import { m } from "../shared/functions";

/**
 * Updates stop loss to be always slightly below the latest low (local min).
 *
 * However, never decreases the stop loss level.
 */
export function trailingLowExit(state: TradeState): StrategyUpdate {
  // Could be optimized to find only the latest low.
  const swingLows = m.getSwingLows(state.series);

  if (!swingLows.length) {
    return {};
  }

  const latestLowCandle = swingLows[swingLows.length - 1];

  // Stop loss should be slightly below the support level.
  // Here the margin is relative to the recent average candle size.
  const margin =
    m.getAverageCandleSize(
      state.series.slice(0, m.indexOf(state.series, latestLowCandle) + 1),
      10
    ) / 4;

  const stopLoss = latestLowCandle.low - margin;

  // Don't allow decreasing stop loss.
  if (state.stopLoss && stopLoss < state.stopLoss) {
    return {};
  }

  return { stopLoss };
}
