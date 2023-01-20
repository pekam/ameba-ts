import {
  allInStaker,
  AssetState,
  backtest,
  BacktestArgs,
  backtestLazy,
  BacktestResult,
  CandleSeries,
  timestampFromUTC,
  TradingStrategy,
  withStaker,
} from "../src";
import { last } from "../src/util/util";
import { testData } from "./test-data/testData";

const series: CandleSeries = testData.getBtcHourly();

const strat: TradingStrategy = (state: AssetState) => {
  const newCandle = last(state.series);
  if (!state.position) {
    if (newCandle.close > newCandle.open) {
      const entryPrice = newCandle.high;
      return {
        entryOrder: {
          type: "stop",
          price: entryPrice,
          side: "buy",
        },
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

const backtestRange = {
  from: timestampFromUTC(2021, 10, 2),
  to: timestampFromUTC(2021, 10, 8),
};

const args: Omit<BacktestArgs, "series"> = {
  strategy: withStaker(strat, allInStaker),
  ...backtestRange,
  initialBalance: 100,
};

function assertBacktestResult(result: BacktestResult) {
  // This is basically a snapshot test
  expect(result.stats.endBalance).toBe(103.966784092104632);
  expect(result.stats.relativeProfit).toBe(0.03966784092104632);
  expect(result.stats.tradeCount).toBe(22);

  expect(result.stats.range.from).toBe(backtestRange.from);
  expect(result.stats.range.to).toBe(backtestRange.to);
}

it("should produce a backtest result", () => {
  const result: BacktestResult = backtest({
    ...args,
    series: {
      BTC: series,
    },
  });
  assertBacktestResult(result);
});

it("should produce a backtest result (lazy)", async () => {
  const result: BacktestResult = await backtestLazy({
    ...args,
    candleProvider: (previousCandleTime) => {
      const candle = previousCandleTime
        ? series.find((c) => c.time > previousCandleTime)
        : series[0];
      if (!candle) {
        return Promise.resolve(undefined);
      }
      return Promise.resolve({
        time: candle.time,
        nextCandles: [{ symbol: "BTC", candle }],
      });
    },
  });
  assertBacktestResult(result);
});
