import { Strategy } from "../core/types";
import { findLowIndices, getAverageCandleSize } from "./series-util";

/**
 * Updates stop loss to be always slightly below the latest low (local min).
 *
 * However, never decreases the stop loss level.
 */
export const trailingLowExit: Strategy = (tradeState) => {
  // Could be optimized to find only the latest low.
  const lowIndices = findLowIndices(tradeState.series);

  if (!lowIndices.length) {
    return {};
  }

  const latestLowIndex = lowIndices[lowIndices.length - 1];

  const latestLowCandle = tradeState.series[latestLowIndex];

  // Stop loss should be slightly below the support level.
  // Here the margin is relative to the recent average candle size.
  const margin =
    getAverageCandleSize(tradeState.series.slice(0, latestLowIndex + 1), 10) /
    4;

  const stopLoss = latestLowCandle.low - margin;

  // Don't allow decreasing stop loss.
  if (tradeState.stopLoss && stopLoss < tradeState.stopLoss) {
    return {};
  }

  return { stopLoss };
};
