import { dropWhile, takeWhile } from "lodash/fp";
import { pipe } from "remeda";
import {
  allInStaker,
  AssetState,
  backtest,
  BacktestResult,
  CandleDataProvider,
  CandleSeries,
  createAsyncCandleProvider,
  TradingStrategy,
  withStaker,
} from "../src";
import { CommonBacktestArgs } from "../src/core/backtest";
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
  from: "2021-10-02",
  to: "2021-10-08",
};

const args: CommonBacktestArgs = {
  strategy: withStaker(strat, allInStaker),
  ...backtestRange,
  initialBalance: 100,
};

function assertBacktestResult(result: BacktestResult) {
  expect(result.stats).toEqual({
    buyAndHoldProfit: 0.12410729114764989,
    endBalance: 103.96678409210463,
    initialBalance: 100,
    range: {
      from: 1633132800,
      to: 1633651200,
    },
    relativeProfit: 0.03966784092104632,
    successRate: 0.5909090909090909,
    tradeCount: 22,
  });
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

it("should produce a backtest result (async)", async () => {
  const result: BacktestResult = await backtest({
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

it("should produce a backtest result (async data provider)", async () => {
  const dataProvider: CandleDataProvider = ({
    symbol,
    from,
    to,
    timeframe,
  }) => {
    if (symbol !== "BTC") {
      throw Error("Unexpected symbol requested " + symbol);
    }
    if (timeframe !== "1h") {
      throw Error("Unexpected timeframe requested " + timeframe);
    }
    const candles = pipe(
      series,
      dropWhile((c) => c.time < from),
      takeWhile((c) => c.time <= to)
    );
    return Promise.resolve(candles);
  };

  const result: BacktestResult = await backtest({
    ...args,
    candleProvider: createAsyncCandleProvider({
      dataProvider,
      symbols: ["BTC"],
      timeframe: "1h",
      batchSize: 10,
      ...backtestRange,
    }),
  });
  assertBacktestResult(result);
});
