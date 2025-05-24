import { allInStaker, backtestSync, withStaker } from "../src";
import {
  AssetStatePredicate,
  CandleDataPredicate,
  composeStrategy,
  conditionExit,
} from "../src/compose-strategy";
import { last } from "../src/util/util";
import { testData } from "./test-data/testData";

describe("composeStrategy", () => {
  it("should support both AssetStatePredicates and CandleDataPredicates", () => {
    // The point here is to just check that the code runs without TS or runtime
    // errors and produces something sensible.

    // Two instances of each to avoid conflicting entry/exit conditions:
    const candleDataPredicate1: CandleDataPredicate = (state) =>
      last(state.series).close > last(state.series).open;
    const candleDataPredicate2: CandleDataPredicate = (state) =>
      last(state.series).close < last(state.series).open;

    const assetStatePredicate1: AssetStatePredicate = (state) =>
      state.trades.length < 1;
    const assetStatePredicate2: AssetStatePredicate = (state) =>
      state.trades.length > 1;

    const strategy = composeStrategy({
      filters: [candleDataPredicate1, assetStatePredicate1],
      entry: () => ({
        side: "buy",
        type: "market",
      }),
      exits: [
        conditionExit(candleDataPredicate2),
        conditionExit(assetStatePredicate2),
        (state) => ({
          stopLoss: last(state.series).low,
        }),
      ],
    });

    const result = backtestSync({
      series: {
        BTC: testData.getBtcHourly().slice(0, 10),
      },
      strategy: withStaker(strategy, allInStaker),
      initialBalance: 100,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "stats": {
          "buyAndHoldProfit": 0.024709103353867213,
          "candleTimeRange": {
            "from": 1633046400,
            "to": 1633078800,
          },
          "endBalance": 99.2502343017807,
          "initialBalance": 100,
          "relativeProfit": -0.007497656982193064,
          "tradeCount": 1,
          "winRate": 0,
        },
        "trades": [
          {
            "absoluteProfit": -0.7497656982193064,
            "entry": {
              "commission": 0,
              "price": 43751,
              "side": "buy",
              "size": 0.002285871031156422,
              "time": 1633053600,
            },
            "exit": {
              "commission": 0,
              "price": 43423,
              "side": "sell",
              "size": 0.002285871031156422,
              "time": 1633053600,
            },
            "position": {
              "side": "long",
              "size": 0.002285871031156422,
            },
            "relativeProfit": -0.007496971497794336,
            "symbol": "BTC",
          },
        ],
      }
    `);
  });
});
