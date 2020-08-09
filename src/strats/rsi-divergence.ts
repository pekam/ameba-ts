import { Candle, CandleSeries } from "../core/candle-series";
import { findLowIndices } from "./series-util";

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

  const divergenceIndices = lowIndices.filter((lowIndex, indexInList) => {
    const currentLowCandle = series[lowIndex];
    const previousLowCandle = series[lowIndices[indexInList - 1]];
    return (
      previousLowCandle &&
      currentLowCandle.low < previousLowCandle.low &&
      currentLowCandle.indicators.rsi(rsiPeriod) >
        previousLowCandle.indicators.rsi(rsiPeriod)
    );
  });

  return divergenceIndices.map((index) => series[index]);
}
