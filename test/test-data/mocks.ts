import {
  AssetState,
  Candle,
  Moment,
  PERIODS,
  toTimestamp,
  Trade,
} from "../../src";

export function mockCandle(
  overrides?: Partial<Pick<Candle, "open" | "time" | "volume">>
): Candle {
  const open = overrides?.open ?? 2;

  return {
    open,
    high: open + 2,
    low: open - 1,
    close: open + 1,

    time: overrides?.time ?? toTimestamp("2020-01-01"),
    volume: overrides?.volume ?? 100,
  };
}

export function mockTrade(entryTime: Moment): Trade {
  const entryTimeSeconds = toTimestamp(entryTime);
  const exitTimeSeconds = entryTimeSeconds + PERIODS.minute;
  return {
    symbol: "foo",
    entry: {
      side: "buy",
      size: 10,
      price: 100,
      time: entryTimeSeconds,
      commission: 0,
    },
    exit: {
      side: "sell",
      size: 10,
      price: 120,
      time: exitTimeSeconds,
      commission: 0,
    },
    position: {
      side: "long",
      size: 10,
    },
    absoluteProfit: 200,
    relativeProfit: 0.2,
  };
}

export function mockAssetState(overrides?: Partial<AssetState>): AssetState {
  return {
    symbol: "foo",
    series: [mockCandle()],
    position: null,
    entryOrder: null,
    takeProfit: null,
    stopLoss: null,
    bufferSize: 100,
    data: {},
    transactions: [],
    trades: [],
    ...overrides,
  };
}
