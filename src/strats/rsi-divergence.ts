import { CandleSeries } from "../core/candle-series";
import { getSwingLows } from "./series-util";
import { RSI } from "technicalindicators";
import { Candle } from "../core/types";

/**
 * Returns the candles where there is a positive RSI divergence.
 * It means that the price makes a lower low (local min) than the previous low,
 * but the RSI is higher than the RSI of the previous low candle.
 */
export function findRSIDivergences(
  series: CandleSeries,
  rsiPeriod: number
): Candle[] {
  const swingLows = getSwingLows(series);

  const rsiValues = RSI.calculate({
    period: rsiPeriod,
    values: series.map((c) => c.close),
  });
  const lengthDiff: number = series.length - rsiValues.length;

  // TODO should be tested again before using
  const divergenceCandles = swingLows.filter((lowCandle, indexInList) => {
    const previousLowCandle = swingLows[indexInList - 1];
    return (
      previousLowCandle &&
      lowCandle.low < previousLowCandle.low &&
      rsiValues[lowCandle.index + lengthDiff] >
        rsiValues[swingLows[indexInList - 1].index + lengthDiff]
    );
  });
  return divergenceCandles;
}
