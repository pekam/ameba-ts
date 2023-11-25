import { omit, pipe, takeWhile } from "remeda";
import {
  AssetState,
  BacktestAsyncArgs,
  BacktestResult,
  BacktestStatistics,
  BacktestSyncResult,
  BacktestSyncStatistics,
  CandleDataProvider,
  CandleSeries,
  Persister,
  TradingStrategy,
  allInStaker,
  backtest,
  backtestSync,
  getPersistedBacktestResult,
  toTimestamp,
  withStaker,
} from "../src";
import { CommonBacktestArgs } from "../src/backtest/backtest";
import { Dictionary } from "../src/util/type-util";
import { dropWhile, last } from "../src/util/util";
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

const expectedStatistics: BacktestStatistics = {
  buyAndHoldProfit: 0.12410729114764989,
  endBalance: 106.0671231646724,
  initialBalance: 100,
  candleTimeRange: {
    from: 1633132800,
    to: 1633651200,
  },
  relativeProfit: 0.06067123164672395,
  winRate: 0.6363636363636364,
  tradeCount: 22,
  dataInfo: {
    dataProviderName: "test-data-provider",
    symbols: ["BTC"],
    timeframe: "1h",
    from: toTimestamp(backtestRange.from),
    to: toTimestamp(backtestRange.to),
  },
};

const expectedSyncStatistics: BacktestSyncStatistics = omit(
  expectedStatistics,
  ["dataInfo"]
);

function assertBacktestResult(result: BacktestResult) {
  expect(result.stats).toEqual(expectedStatistics);
}

function assertBacktestSyncResult(result: BacktestSyncResult) {
  expect(result.stats).toEqual(expectedSyncStatistics);
}

it("should produce a backtest result (sync)", () => {
  const result: BacktestSyncResult = backtestSync({
    ...args,
    series: {
      BTC: series,
    },
  });
  assertBacktestSyncResult(result);
});

const dataProvider: CandleDataProvider = {
  name: "test-data-provider",
  getCandles: ({ symbol, from, to, timeframe }) => {
    if (symbol !== "BTC") {
      throw Error("Unexpected symbol requested " + symbol);
    }
    if (timeframe !== "1h") {
      throw Error("Unexpected timeframe requested " + timeframe);
    }
    const candles = pipe(
      series,
      dropWhile((c) => c.time < toTimestamp(from)),
      takeWhile((c) => c.time <= toTimestamp(to))
    );
    return Promise.resolve(candles);
  },
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

  const erroringCandleProvider: CandleDataProvider = {
    name: dataProvider.name,
    getCandles: (args) => {
      if (toTimestamp(args.to) > errorOnTimestamps[errorCount]) {
        errorCount++;
        throw Error("intentional error to test persistence");
      }
      return dataProvider.getCandles(args);
    },
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
      async getKeys() {
        return Object.keys(store);
      },
    };
  })();

  let result: BacktestResult | undefined = undefined;

  const doBacktest = () =>
    backtest({
      ...asyncArgs,
      dataProvider: erroringCandleProvider,
      persistence: {
        persister: fakePersister,
        interval: 2,
        key: "foo",
      },
    });

  while (!result) {
    try {
      result = await doBacktest();
    } catch (e) {
      // expected
    }
  }
  assertBacktestResult(result);
  expect(errorCount).toBe(errorOnTimestamps.length);
  expect(persistedStateFetchedCount).toBe(errorOnTimestamps.length);

  // After finishing, the result should be persisted, so let's make sure that it
  // is correct as well:
  assertBacktestResult(
    (await getPersistedBacktestResult(fakePersister, "foo"))!
  );

  // When result exists for this backtest key, backtest should return the result
  // immediately without running again. Let's test this path as well.
  assertBacktestResult(await doBacktest());
});
