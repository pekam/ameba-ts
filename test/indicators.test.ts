import { RawCandle } from "../src/types";
import { CandleSeries } from "../src/CandleSeries";
import { addSMA } from "../src/indicators";

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
