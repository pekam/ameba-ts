import { Strategy } from "../core/types";
import { findLowIndices } from "./series-util";
import { Candle, CandleSeries } from "../core/candle-series";

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

function getAverageCandleSize(series: CandleSeries, countFromEnd: number) {
  const head: Candle[] =
    series.length >= countFromEnd ? series.slice(-countFromEnd) : series;
  return (
    head
      .map((candle) => candle.high - candle.low)
      .reduce((acc, candleSize) => acc + candleSize, 0) / head.length
  );
}
