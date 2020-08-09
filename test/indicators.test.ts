import { RawCandle } from "../src/core/types";
import { CandleSeries } from "../src/core/candle-series";
import { initTestData } from "./testData";

it("should calculate SMA", () => {
  const rawCandles: RawCandle[] = Array.from(Array(5).keys()).map(
    (index: number) => {
      return { close: index + 1, high: 0, low: 0, open: 0, time: 0, volume: 0 };
    }
  );
  const series = new CandleSeries(...rawCandles);

  const smaValues: number[] = series.map((c) => c.indicators.sma(3));

  expect(smaValues).toEqual([undefined, undefined, 2, 3, 4]);
});

it("should calculate RSI", () => {
  const series: CandleSeries = initTestData();

  /*
   This is basically a snapshot test (the expected values haven't been verified).
   The values are slightly different compared to what TradingView displays,
   because usually RSI is calculated based on previous RSI, but we are calculating
   each RSI in isolation as the "initial" RSI value.
   */
  const expectedRSI: number[] = Array(14)
    .fill(undefined)
    .concat([72.95, 75.05, 77.16, 75.41, 75.31, 65.15, 58.07, 60.61]);

  const actualRSI = series.map((candle) => candle.indicators.rsi(14));

  expect(actualRSI).toEqual(expectedRSI);
});
