import { backtest } from "../src/core/backtest";
import { FullTradingStrategy, SeriesMap } from "../src/core/types";
import { testData } from "./test-data/testData";

it("should remove old candles when bufferSize reached", () => {
  const series: SeriesMap = {
    a: testData.getSimpleTestData(5),
    b: testData.getSimpleTestData(5),
  };

  const bufferSize = 3;
  // prettier-ignore
  const expectedCandleTimes = [
    [1],
    [1, 2],
    [1, 2, 3],
    [2, 3, 4],
    [3, 4, 5],
  ];

  let round = 0;
  const strategy: FullTradingStrategy = (state) => {
    const getCandleTimes = (symbol: string) =>
      state.assets[symbol].series.map((c) => c.time);

    expect(getCandleTimes("a")).toEqual(expectedCandleTimes[round]);
    expect(getCandleTimes("b")).toEqual(expectedCandleTimes[round]);

    round++;
    return {};
  };

  backtest({
    series,
    strategy,
    progressHandler: null,
    bufferSize,
  });

  expect(round).toBe(expectedCandleTimes.length);
});
