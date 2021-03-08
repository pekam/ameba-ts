import { CandleSeries } from "../core/candle-series";
import { m } from "./functions";
import { EMA, SMA } from "technicalindicators";
import { Candle } from "../core/types";

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
};
