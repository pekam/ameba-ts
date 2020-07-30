import { Candle, CandleSeries } from "./CandleSeries";
import { RSI, SMA } from "technicalindicators";

/**
 * Adds simple moving average values to the candles in the series.
 *
 * @param series
 * @param period
 */
export function addSMA(series: CandleSeries, period: number): void {
  if (series.length < period) {
    return;
  }

  const smaValues = SMA.calculate({
    period,
    values: series.map((c) => c.close),
  });

  setIndicatorValues(series, smaValues, "sma" + period);
}

/**
 * Adds relative strength index to the candles in the series.
 *
 * @param series
 * @param period
 */
export function addRSI(series: CandleSeries, period: number): void {
  if (series.length < period) {
    return;
  }

  const rsiValues = RSI.calculate({
    period,
    values: series.map((c) => c.close),
  });

  setIndicatorValues(series, rsiValues, "rsi" + period);
}

function setIndicatorValues(
  series: CandleSeries,
  indicatorValues: any[],
  key: string
) {
  const lengthDiff: number = series.length - indicatorValues.length;
  series.forEach((candle: Candle, index: number) => {
    candle.indicators[key] = indicatorValues[index - lengthDiff];
  });
}
