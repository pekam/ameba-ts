import { RawCandle } from "../src/core/types";
import { CandleSeries } from "../src/core/candle-series";
import { initTestData } from "./testData";
import { Indicators } from "../src/core/indicators";

it("should calculate SMA", () => {
  const rawCandles: RawCandle[] = Array.from(Array(5).keys()).map(
    (index: number) => {
      return { close: index + 1, high: 0, low: 0, open: 0, time: 0, volume: 0 };
    }
  );
  const series = new CandleSeries(...rawCandles);

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
