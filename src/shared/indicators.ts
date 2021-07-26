import { m } from "./functions";
import { ATR, EMA, SMA } from "technicalindicators";
import { Candle, CandleSeries } from "../core/types";

export interface IndicatorResult {
  values: number[];
  last: number;
  get: (c: Candle) => number;
}

function sma(series: CandleSeries, period: number): IndicatorResult {
  const values = series.map(m.close);
  const smas = SMA.calculate({ values, period });
  return toResult(series, smas);
}
function ema(series: CandleSeries, period: number): IndicatorResult {
  const values = series.map(m.close);
  const emas = EMA.calculate({ values, period });
  return toResult(series, emas);
}

function atr(series: CandleSeries, period: number): IndicatorResult {
  const atrs = ATR.calculate({
    low: series.map(m.low),
    high: series.map(m.high),
    close: series.map(m.close),
    period,
  });
  return toResult(series, atrs);
}

function toResult(
  series: CandleSeries,
  indicatorValues: number[]
): IndicatorResult {
  return {
    values: indicatorValues,
    last: m.last(indicatorValues),
    get: (c) =>
      indicatorValues[
        m.indexOf(series, c) - (series.length - indicatorValues.length)
      ],
  };
}

export const indicators = {
  sma,
  ema,
  atr,
};
