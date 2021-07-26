import { StrategyUpdate } from "../core/types";
import { m } from "../shared/functions";

/**
 * Updates stop loss to be always slightly below the latest low (local min).
 *
 * However, never decreases the stop loss level.
 */
export const trailingLowExit: StrategyUpdate = (tradeState) => {
  // Could be optimized to find only the latest low.
  const swingLows = m.getSwingLows(tradeState.series);

  if (!swingLows.length) {
    return {};
  }

  const latestLowCandle = swingLows[swingLows.length - 1];

  // Stop loss should be slightly below the support level.
  // Here the margin is relative to the recent average candle size.
  const margin =
    m.getAverageCandleSize(
      tradeState.series.slice(
        0,
        m.indexOf(tradeState.series, latestLowCandle) + 1
      ),
      10
    ) / 4;

  const stopLoss = latestLowCandle.low - margin;

  // Don't allow decreasing stop loss.
  if (tradeState.stopLoss && stopLoss < tradeState.stopLoss) {
    return {};
  }

  return { stopLoss };
};
