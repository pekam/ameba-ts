import { takeWhile } from "lodash";
import { backtestStrategy } from "../src/core/backtest";
import {
  backtestMultiple,
  MultiAssetStrategy,
  MultiAssetTradeState,
} from "../src/core/backtest-multiple";
import { BacktestResult } from "../src/core/backtest-result";
import { CandleSeries, Order, Strategy, TradeState } from "../src/core/types";
import { m } from "../src/shared/functions";
import { PERIODS, timestampFromUTC } from "../src/shared/time-util";
import { testData } from "./test-data/testData";

const series: CandleSeries = testData.getBtcHourly();

const backtestRange = {
  from: timestampFromUTC(2021, 10, 2),
  to: timestampFromUTC(2021, 10, 8),
};

const strat: Strategy = (state: TradeState) => {
  const newCandle = m.last(state.series);
  if (!state.position) {
    if (newCandle.close > newCandle.open) {
      const entryPrice = newCandle.high;
      const entryOrder: Order = {
        type: "stop",
        price: entryPrice,
        side: "buy",
        size: state.cash / entryPrice,
      };
      return {
        entryOrder,
        stopLoss: entryPrice * 0.99,
        takeProfit: entryPrice * 1.01,
      };
    } else {
      return {
        entryOrder: null,
        stopLoss: null,
        takeProfit: null,
      };
    }
  } else {
    return {};
  }
};

it("should produce a backtest result", () => {
  const result: BacktestResult = backtestStrategy({
    stratProvider: () => strat,
    series,
    ...backtestRange,
    initialBalance: 100,
  });

  testResult(result);
});

function testResult(result: BacktestResult) {
  // This is basically a snapshot test
  expect(result.stats.endBalance).toBe(103.966784092104632);
  expect(result.stats.relativeProfit).toBe(0.03966784092104632);
  expect(result.stats.tradeCount).toBe(22);

  expect(result.stats.range.from).toBe(backtestRange.from);
  expect(result.stats.range.to).toBe(backtestRange.to - PERIODS.hour);
}

it("multi-backtest with single asset should produce the same result", () => {
  const multiStrat: MultiAssetStrategy = (multiState: MultiAssetTradeState) => {
    return multiState.updated
      .map((a) => multiState.assets[a])
      .map((asset) => {
        return {
          ...strat({ ...asset, cash: multiState.cash }),
          symbol: asset.symbol,
        };
      });
  };

  const result: BacktestResult = backtestMultiple({
    stratProvider: () => multiStrat,
    // 'to' not supported, so cutting the array instead
    multiSeries: { btc: takeWhile(series, (c) => c.time < backtestRange.to) },
    ...backtestRange,
    initialBalance: 100,
  });

  testResult(result);
});
