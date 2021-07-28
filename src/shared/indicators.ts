import regression, { DataPoint } from "regression";
import { ATR, EMA, SMA } from "technicalindicators";
import { Candle, CandleSeries } from "../core/types";
import { m } from "./functions";

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

function linearRegression(series: CandleSeries, period: number) {
  const input: DataPoint[] = series.slice(-period).map((c, i) => [i, c.close]);
  const result = regression.linear(input);
  const regressionValues = result.points.map((p) => p[1]);
  return { ...toResult(series, regressionValues), regressionResult: result };
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

function withTimes(
  indicatorValues: number[],
  series: CandleSeries
): { value: number; time: number }[] {
  const lengthDiff = series.length - indicatorValues.length;
  return indicatorValues.map((value, i) => ({
    value,
    time: series[i + lengthDiff].time,
  }));
}

export const indicators = {
  sma,
  ema,
  atr,
  linearRegression,
  withTimes,
};
