import { Candle, CandleSeries } from "../core/candle-series";
import { findLowIndices } from "./series-util";
import { RSI } from "technicalindicators";

/**
 * Returns the candles where there is a positive RSI divergence.
 * It means that the price makes a lower low (local min) than the previous low,
 * but the RSI is higher than the RSI of the previous low candle.
 */
export function findRSIDivergences(
  series: CandleSeries,
  rsiPeriod: number
): Candle[] {
  const lowIndices = findLowIndices(series);

  const rsiValues = RSI.calculate({
    period: rsiPeriod,
    values: series.map((c) => c.close),
  });
  const lengthDiff: number = series.length - rsiValues.length;

  // TODO should be tested again before using
  const divergenceIndices = lowIndices.filter((lowIndex, indexInList) => {
    const currentLowCandle = series[lowIndex];
    const previousLowCandle = series[lowIndices[indexInList - 1]];
    return (
      previousLowCandle &&
      currentLowCandle.low < previousLowCandle.low &&
      rsiValues[lowIndex + lengthDiff] >
        rsiValues[lowIndices[indexInList - 1] + lengthDiff]
    );
  });

  return divergenceIndices.map((index) => series[index]);
}
