import { dropWhile, takeWhile } from "lodash/fp";
import { pipe } from "remeda";
import {
  allInStaker,
  AssetState,
  backtest,
  BacktestAsyncArgs,
  BacktestResult,
  backtestSync,
  CandleDataProvider,
  CandleSeries,
  Persister,
  toTimestamp,
  TradingStrategy,
  withStaker,
} from "../src";
import { CommonBacktestArgs } from "../src/backtest/backtest";
import { Dictionary } from "../src/util/type-util";
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

it("should produce a backtest result (sync)", () => {
  const result: BacktestResult = backtestSync({
    ...args,
    series: {
      BTC: series,
    },
  });
  assertBacktestResult(result);
});

const dataProvider: CandleDataProvider = ({ symbol, from, to, timeframe }) => {
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

const asyncArgs: BacktestAsyncArgs = {
  ...args,
  dataProvider,
  symbols: ["BTC"],
  timeframe: "1h",
  batchSize: 10,
  ...backtestRange,
};

it("should produce a backtest result (async data provider)", async () => {
  const result: BacktestResult = await backtest(asyncArgs);
  assertBacktestResult(result);
});

it("should produce a backtest result (persister)", async () => {
  let errorCount = 0;
  let persistedStateFetchedCount = 0;
  const errorOnTimestamps = [50, 100, 101, 150].map((i) => series[i].time);

  const erroringCandleProvider: CandleDataProvider = (args) => {
    if (toTimestamp(args.to) > errorOnTimestamps[errorCount]) {
      errorCount++;
      throw Error("intentional error to test persistence");
    }
    return dataProvider(args);
  };

  const fakePersister: Persister = (() => {
    const store: Dictionary<string> = {};

    return {
      async get(key) {
        const s = store[JSON.stringify(key)];
        if (s) {
          persistedStateFetchedCount++;
          return JSON.parse(s);
        }
        return null;
      },
      async set(key, value) {
        store[JSON.stringify(key)] = JSON.stringify(value);
      },
    };
  })();

  let result: BacktestResult | undefined = undefined;

  while (!result) {
    try {
      result = await backtest({
        ...asyncArgs,
        dataProvider: erroringCandleProvider,
        persistence: {
          persister: fakePersister,
          interval: 2,
          key: "foo",
        },
      });
    } catch (e) {
      // expected
    }
  }
  assertBacktestResult(result);
  expect(errorCount).toBe(errorOnTimestamps.length);
  expect(persistedStateFetchedCount).toBe(errorOnTimestamps.length);
});
