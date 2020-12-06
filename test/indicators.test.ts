import { RawCandle } from "../src/core/types";
import { CandleSeries, toCandleSeries } from "../src/core/candle-series";
import { initTestData } from "./testData";
import { Indicators } from "../src/core/indicators";

it("should calculate SMA", () => {
  const rawCandles: RawCandle[] = Array.from(Array(5).keys()).map(
    (index: number) => {
      return { close: index + 1, high: 0, low: 0, open: 0, time: 0, volume: 0 };
    }
  );
  const series = toCandleSeries(rawCandles);

  const indicators = new Indicators(
    { smaPeriod: 3 },
    series.slice(0, series.length - 1)
  );
  expect(indicators.update(series.slice(0, series.length - 1)).sma).toEqual(3);
  expect(indicators.update(series.slice(0, series.length)).sma).toEqual(4);
});

it("should calculate RSI", () => {
  const series: CandleSeries = initTestData();

  const indicators = new Indicators(
    { rsiPeriod: 14 },
    series.slice(0, series.length)
  );

  expect(indicators.update(series).rsi).toEqual(68.64);
});

it("should calculate ADX, -DI and +DI", () => {
  const series: CandleSeries = initTestData();

  const indicators = new Indicators(
    { adxPeriod: 5 },
    series.slice(0, series.length)
  );

  const indicatorValues = indicators.update(series.slice(0, series.length));

  expect(indicatorValues.adx).toEqual(51.13149970472207);
  expect(indicatorValues.mdi).toEqual(16.371051834388975);
  expect(indicatorValues.pdi).toEqual(41.70673288249668);
});
