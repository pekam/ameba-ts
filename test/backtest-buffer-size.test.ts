import { range } from "remeda";
import { getSma } from "../src";
import { backtestSync } from "../src/core/backtest";
import { FullTradingStrategy, SeriesMap } from "../src/core/types";
import { last } from "../src/util/util";
import { testData } from "./test-data/testData";

const series: SeriesMap = {
  a: testData.getSimpleTestData(5),
  b: testData.getSimpleTestData(5),
};

it("should remove old candles when bufferSize reached", () => {
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

  backtestSync({
    series,
    strategy,
    progressHandler: null,
    bufferSize,
  });

  expect(round).toBe(expectedCandleTimes.length);
});

it("should remove old indicator values when bufferSize reached", () => {
  const smaPeriod = 2;
  const bufferSize = 2;
  // prettier-ignore
  const expectedSmaEachRound = [
    undefined,
    2.5,
    3.5,
    4.5,
    5.5
  ];
  // prettier-ignore
  const expectedSmaFinalRound = [
    undefined,
    undefined,
    undefined,
    4.5,
    5.5
  ];

  let smaEachRound: (number | undefined)[] = [];
  let smaFinalRound: (number | undefined)[] = [];
  const strategy: FullTradingStrategy = (state) => {
    const sma = getSma(state.assets.a, smaPeriod);
    smaEachRound.push(sma);
    if (state.time === last(series.a).time) {
      smaFinalRound = range(0, series.a.length)
        .reverse()
        .map((indexFromEnd) => getSma(state.assets.a, smaPeriod, indexFromEnd));
    }
    return {};
  };

  backtestSync({
    series,
    strategy,
    progressHandler: null,
    bufferSize,
  });

  expect(smaEachRound).toEqual(expectedSmaEachRound);
  expect(smaFinalRound).toEqual(expectedSmaFinalRound);
});
