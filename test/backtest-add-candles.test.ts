import { last } from "lodash/fp";
import { backtestSync } from "../src";
import { Candle, FullTradingStrategy, SeriesMap } from "../src/core/types";

it("should add the next candles with equal timestamps for each iteration", () => {
  function createCandle(time: number): Candle {
    return { open: 1, high: 1, low: 1, close: 1, volume: 1, time };
  }

  const series: SeriesMap = {
    a: [1, 2, 5].map(createCandle),
    b: [1, 5, 10].map(createCandle),
  };

  const expected = [
    {
      time: 1,
      updated: ["a", "b"],
    },
    {
      time: 2,
      updated: ["a"],
    },
    {
      time: 5,
      updated: ["a", "b"],
    },
    {
      time: 10,
      updated: ["b"],
    },
  ];

  let round = 0;
  const strategy: FullTradingStrategy = (state) => {
    const actual = {
      time: state.time,
      updated: state.updated,
    };

    expect(actual).toEqual(expected[round]);

    state.updated
      .map((symbol) => state.assets[symbol])
      .forEach((asset) => expect(last(asset.series)!.time).toBe(state.time));

    round++;
    return {};
  };

  backtestSync({
    series,
    strategy,
    progressHandler: null,
  });

  expect(round).toBe(expected.length);
});
