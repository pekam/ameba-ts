import { Candle, CandleSeries } from "./CandleSeries";
import { SMA } from "technicalindicators";

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

  const lengthDiff: number = series.length - smaValues.length;
  const key: string = "sma" + period;

  series.forEach((candle: Candle, index: number) => {
    candle.indicators[key] = smaValues[index - lengthDiff];
  });
}
