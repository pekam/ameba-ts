import { mapToObj, omit } from "remeda";
import {
  backtestSync,
  CommissionProvider,
  EquityCurvePoint,
  FullTradingStrategy,
  getEquityCurve,
  Order,
} from "../src";
import { last } from "../src/util/util";
import { testData } from "./test-data/testData";

const strategy: FullTradingStrategy = (state) => {
  return mapToObj(state.updated, (symbol) => {
    const asset = state.assets[symbol];
    const price = last(asset.series).close;

    const entryOrder: Order = {
      side: "buy",
      size: 1,
      type: "market",
    };
    const update = asset.position
      ? {}
      : symbol === "a"
      ? {
          entryOrder,
          stopLoss: price - 10,
          takeProfit: price + 20,
        }
      : {
          entryOrder,
          stopLoss: price - 20,
          takeProfit: price + 10,
        };
    return [symbol, update];
  });
};

const series = testData.getTails({
  startValue: 30,
  // prettier-ignore
  tails: [
    0, -20,
    0, -20,
    0,  20,
    0,  20,
    0, -20,
    0,  20,
    0, -20
  ],
});

const commissionProvider: CommissionProvider = () => 0.5; // 1 per trade

it("should convert backtest result to equity curve", () => {
  const result = backtestSync({
    series: {
      a: series,
    },
    strategy,
    commissionProvider,
    initialBalance: 100,
  });

  const equityCurve = getEquityCurve(
    result.trades,
    result.stats.initialBalance
  );

  expect(omit(equityCurve, ["series"])).toEqual({
    maxAbsoluteDrawdown: 22,
    maxRelativeDrawdown: 0.22,
    peak: 130 - 6,
  });

  // The fift trade (first item in equity series is initialBalance)
  expect(equityCurve.series[5]).toEqual({
    time: 10,
    equity: 105,
    // (peak 116)
    absoluteDrawdown: 11,
    relativeDrawdown: 11 / 116,
  });
});

it("should combine simultaneous trade exits to same equity curve point", () => {
  const result = backtestSync({
    series: {
      a: series,
      b: series,
    },
    strategy,
    commissionProvider,
    initialBalance: 100,
  });

  const equityCurve = getEquityCurve(
    result.trades,
    result.stats.initialBalance
  );

  expect(equityCurve.series.length).toBe(8);

  expect(equityCurve.series[1]).toEqual<EquityCurvePoint>({
    time: 2,
    equity: 68,
    absoluteDrawdown: 32,
    relativeDrawdown: 0.32,
  });
  expect(equityCurve.series[2]).toEqual<EquityCurvePoint>({
    time: 4,
    equity: 36,
    absoluteDrawdown: 64,
    relativeDrawdown: 0.64,
  });
});
