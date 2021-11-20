import { Indicators } from "../src/core/indicators";
import { CandleSeries } from "../src/core/types";
import { testData } from "./test-data/testData";

it("should calculate SMA", () => {
  const series: CandleSeries = Array.from(Array(5).keys()).map(
    (index: number) => {
      return {
        close: index + 1,
        high: 0,
        low: 0,
        open: 0,
        time: index + 1,
        volume: 0,
      };
    }
  );

  const indicators = new Indicators({ smaPeriod: 3 });
  expect(indicators.update(series.slice(0, series.length - 1)).sma).toEqual(3);
  expect(indicators.update(series.slice(0, series.length)).sma).toEqual(4);
});

it("should calculate RSI", () => {
  const series: CandleSeries = testData.getAmznDaily();

  const indicators = new Indicators({ rsiPeriod: 14 });

  expect(indicators.update(series).rsi).toEqual(68.64);
});

it("should calculate ADX, -DI and +DI", () => {
  const series: CandleSeries = testData.getAmznDaily();

  const indicators = new Indicators({ adxPeriod: 5 });

  const indicatorValues = indicators.update(series.slice(0, series.length));

  expect(indicatorValues.adx).toEqual(51.13149970472207);
  expect(indicatorValues.mdi).toEqual(16.371051834388975);
  expect(indicatorValues.pdi).toEqual(41.70673288249668);
});
