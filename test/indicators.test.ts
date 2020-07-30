import { RawCandle } from "../src/types";
import { CandleSeries } from "../src/CandleSeries";
import { addRSI, addSMA } from "../src/indicators";
import { initTestData } from "./testData";

it("should calculate SMA", () => {
  const rawCandles: RawCandle[] = Array.from(Array(5).keys()).map(
    (index: number) => {
      return { close: index + 1, high: 0, low: 0, open: 0, time: 0, volume: 0 };
    }
  );
  const series = new CandleSeries(...rawCandles);
  addSMA(series, 3);

  const smaValues: number[] = series.map((c) => c.indicators.sma3);

  expect(smaValues).toEqual([undefined, undefined, 2, 3, 4]);
});

it("should calculate RSI", () => {
  const series: CandleSeries = initTestData();
  addRSI(series, 14);

  /*
   This is basically a snapshot test (the expected values haven't been verified).
   The values are slightly different compared to what TradingView displays.
   */
  const expectedRSI: number[] = Array(14)
    .fill(undefined)
    .concat([72.95, 75.27, 77.94, 72.92, 74.13, 64.65, 62.89, 68.64]);

  const actualRSI = series.map((candle) => candle.indicators.rsi14);

  expect(actualRSI).toEqual(expectedRSI);
});
