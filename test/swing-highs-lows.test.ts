import { initTestData } from "./testData";
import { CandleSeries } from "../src/core/candle-series";
import { m } from "../src/functions/functions";

it("should find highs (local maximums)", () => {
  const series: CandleSeries = initTestData();

  const highIndices = m.getSwingHighs(series).map(m.indexOf.bind(this, series));
  const expectedHighIndices = [3, 7, 17, 19];

  expect(highIndices).toEqual(expectedHighIndices);
});

it("should find lows (local minimums)", () => {
  const series: CandleSeries = initTestData();

  const lowIndices = m.getSwingLows(series).map(m.indexOf.bind(this, series));
  const expectedLowIndices = [4, 9, 20];

  expect(lowIndices).toEqual(expectedLowIndices);
});
