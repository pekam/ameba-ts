import { initTestData } from "./testData";
import { CandleSeries } from "../src/core/candle-series";
import { getSwingHighs, getSwingLows } from "../src/strats/series-util";

it("should find highs (local maximums)", () => {
  const series: CandleSeries = initTestData();

  const highIndices = getSwingHighs(series).map((c) => c.index);
  const expectedHighIndices = [3, 7, 17, 19];

  expect(highIndices).toEqual(expectedHighIndices);
});

it("should find lows (local minimums)", () => {
  const series: CandleSeries = initTestData();

  const lowIndices = getSwingLows(series).map((c) => c.index);
  const expectedLowIndices = [4, 9, 20];

  expect(lowIndices).toEqual(expectedLowIndices);
});
