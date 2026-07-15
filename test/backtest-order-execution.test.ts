import { omit, pipe } from "remeda";
import {
  AssetState,
  Candle,
  getInitialRisk,
  Order,
  TransactionLiquiditySide,
} from "../src";
import {
  handleOrders,
  OrderHandlerArgs,
} from "../src/backtest/backtest-order-execution";

type TestArgs = Partial<
  Pick<AssetState, "position" | "entryOrder" | "stopLoss" | "takeProfit">
> & { candle: Candle };

function getArgs(args: TestArgs): OrderHandlerArgs {
  const asset: AssetState = {
    symbol: "foo",
    series: [args.candle],
    position: null,
    entryOrder: null,
    stopLoss: null,
    takeProfit: null,
    bufferSize: 100,
    data: {},
    transactions: [],
    trades: [],
    ...omit(args, ["candle"]),
  };
  return {
    asset,
    cash: 100,
    commissionProvider: () => 1,
  };
}

function testHandleOrders(args: TestArgs) {
  const result = pipe(args, getArgs, handleOrders, (r) => ({
    ...r,
    asset: omit(r.asset, ["bufferSize", "data", "series", "symbol"]),
  }));
  expect(result).toMatchSnapshot();
}

function handleOrdersWithoutCommission(asset: AssetState) {
  return handleOrders({
    asset,
    cash: 100,
    commissionProvider: () => 0,
  });
}

function getSingleTransactionLiquiditySide(args: TestArgs) {
  const result = handleOrdersWithoutCommission(getArgs(args).asset);
  expect(result.asset.transactions).toHaveLength(1);
  return result.asset.transactions[0].liquiditySide;
}

const greenCandle: Candle = {
  open: 50,
  close: 60,
  low: 40,
  high: 70,
  volume: 100,
  time: 1,
};

const redCandle: Candle = {
  open: 50,
  close: 40,
  low: 30,
  high: 60,
  volume: 100,
  time: 1,
};

// green candle, long position

it("green candle: should fill entry at bottom tail, skip sl below tail, fill tp at high", () => {
  testHandleOrders({
    candle: greenCandle,
    entryOrder: { side: "buy", type: "limit", size: 1, price: 40 },
    stopLoss: 30,
    takeProfit: 70,
  });
});

it("green candle: should fill entry at bottom tail, fill sl at bottom tail, skip tp at high", () => {
  testHandleOrders({
    candle: greenCandle,
    entryOrder: { side: "buy", type: "limit", size: 1, price: 45 },
    stopLoss: 40,
    takeProfit: 70,
  });
});

it("green candle: should fill entry at body, skip sl in body below entry, fill tp at high", () => {
  testHandleOrders({
    candle: greenCandle,
    entryOrder: { side: "buy", type: "stop", size: 1, price: 55 },
    stopLoss: 52,
    takeProfit: 70,
  });
});

it("green candle: should fill entry and sl immediately", () => {
  testHandleOrders({
    candle: greenCandle,
    entryOrder: { side: "buy", type: "limit", size: 1, price: 55 },
    stopLoss: 52,
  });
});

// green candle, short position

it("green candle: should fill entry", () => {
  testHandleOrders({
    candle: greenCandle,
    entryOrder: { side: "sell", type: "limit", size: 1, price: 55 },
  });
});

it("green candle: should fill short entry at body, skip tp in body below entry, fill sl at high", () => {
  testHandleOrders({
    candle: greenCandle,
    entryOrder: { side: "sell", type: "limit", size: 1, price: 55 },
    stopLoss: 70,
    takeProfit: 52,
  });
});

// red candle, short position

it("red candle: should fill entry at top tail, skip sl above tail, fill tp at low", () => {
  testHandleOrders({
    candle: redCandle,
    entryOrder: { side: "sell", type: "limit", size: 1, price: 60 },
    stopLoss: 70,
    takeProfit: 30,
  });
});

it("red candle: should fill entry at top tail, fill sl at top tail, skip tp at low", () => {
  testHandleOrders({
    candle: redCandle,
    entryOrder: { side: "sell", type: "limit", size: 1, price: 55 },
    stopLoss: 60,
    takeProfit: 30,
  });
});

it("red candle: should fill entry at body, skip sl in body above entry, fill tp at low", () => {
  testHandleOrders({
    candle: redCandle,
    entryOrder: { side: "sell", type: "stop", size: 1, price: 45 },
    stopLoss: 48,
    takeProfit: 30,
  });
});

it("red candle: should fill entry and sl immediately", () => {
  testHandleOrders({
    candle: redCandle,
    entryOrder: { side: "sell", type: "limit", size: 1, price: 45 },
    stopLoss: 48,
  });
});

// red candle, long position

it("red candle: should fill entry", () => {
  testHandleOrders({
    candle: redCandle,
    entryOrder: { side: "buy", type: "limit", size: 1, price: 45 },
  });
});

it("red candle: should fill long entry at body, skip tp in body above entry, fill sl at low", () => {
  testHandleOrders({
    candle: redCandle,
    entryOrder: { side: "buy", type: "limit", size: 1, price: 45 },
    stopLoss: 30,
    takeProfit: 48,
  });
});

it("should store initial stop loss for a completed long trade", () => {
  const result = handleOrdersWithoutCommission({
    symbol: "foo",
    series: [greenCandle],
    position: null,
    entryOrder: { side: "buy", type: "limit", size: 2, price: 40 },
    stopLoss: 30,
    takeProfit: 70,
    initialStopLoss: null,
    bufferSize: 100,
    data: {},
    transactions: [],
    trades: [],
  });

  const trade = result.asset.trades[0];
  expect(trade.initialStopLoss).toBe(30);
  expect(getInitialRisk(trade)).toBe(20);
});

it("should mark market orders as taker transactions", () => {
  expect(
    getSingleTransactionLiquiditySide({
      candle: greenCandle,
      entryOrder: { side: "buy", type: "market", size: 1 },
    })
  ).toBe("taker");
});

it("should mark resting limit orders as maker transactions", () => {
  expect(
    getSingleTransactionLiquiditySide({
      candle: greenCandle,
      entryOrder: { side: "buy", type: "limit", size: 1, price: 40 },
    })
  ).toBe("maker");
});

it("should mark immediately marketable limit orders as taker transactions", () => {
  expect(
    getSingleTransactionLiquiditySide({
      candle: greenCandle,
      entryOrder: { side: "buy", type: "limit", size: 1, price: 55 },
    })
  ).toBe("taker");
});

it("should mark stop orders as taker transactions", () => {
  expect(
    getSingleTransactionLiquiditySide({
      candle: greenCandle,
      entryOrder: { side: "buy", type: "stop", size: 1, price: 55 },
    })
  ).toBe("taker");
});

function handleGapOrder({
  order,
  previousClose,
  nextOpen,
  stopLoss = null,
}: {
  order: Order;
  previousClose: number;
  nextOpen: number;
  stopLoss?: number | null;
}) {
  return handleOrdersWithoutCommission({
    symbol: "foo",
    series: [
      {
        open: previousClose,
        high: previousClose,
        low: previousClose,
        close: previousClose,
        volume: 100,
        time: 1,
      },
      {
        open: nextOpen,
        high: nextOpen,
        low: nextOpen,
        close: nextOpen,
        volume: 100,
        time: 2,
      },
    ],
    position: null,
    entryOrder: order,
    stopLoss,
    takeProfit: null,
    initialStopLoss: null,
    bufferSize: 100,
    data: {},
    transactions: [],
    trades: [],
  });
}

type ExpectedGapFill = {
  price: number;
  liquiditySide: TransactionLiquiditySide;
} | null;

it.each<{
  description: string;
  order: Order;
  previousClose: number;
  nextOpen: number;
  expected: ExpectedGapFill;
}>([
  {
    description: "buy limit crossing down-to-up",
    order: { side: "buy", type: "limit", size: 1, price: 100 },
    previousClose: 90,
    nextOpen: 110,
    expected: null,
  },
  {
    description: "buy limit crossing up-to-down",
    order: { side: "buy", type: "limit", size: 1, price: 100 },
    previousClose: 110,
    nextOpen: 90,
    expected: { price: 100, liquiditySide: "maker" },
  },
  {
    description: "buy limit already executable on both sides of the gap",
    order: { side: "buy", type: "limit", size: 1, price: 100 },
    previousClose: 90,
    nextOpen: 80,
    expected: { price: 80, liquiditySide: "taker" },
  },
  {
    description: "buy stop crossing down-to-up",
    order: { side: "buy", type: "stop", size: 1, price: 100 },
    previousClose: 90,
    nextOpen: 110,
    expected: { price: 110, liquiditySide: "taker" },
  },
  {
    description: "buy stop crossing up-to-down",
    order: { side: "buy", type: "stop", size: 1, price: 100 },
    previousClose: 110,
    nextOpen: 90,
    expected: null,
  },
  {
    description: "buy stop already executable on both sides of the gap",
    order: { side: "buy", type: "stop", size: 1, price: 100 },
    previousClose: 110,
    nextOpen: 120,
    expected: { price: 120, liquiditySide: "taker" },
  },
  {
    description: "sell limit crossing down-to-up",
    order: { side: "sell", type: "limit", size: 1, price: 100 },
    previousClose: 90,
    nextOpen: 110,
    expected: { price: 100, liquiditySide: "maker" },
  },
  {
    description: "sell limit crossing up-to-down",
    order: { side: "sell", type: "limit", size: 1, price: 100 },
    previousClose: 110,
    nextOpen: 90,
    expected: null,
  },
  {
    description: "sell limit already executable on both sides of the gap",
    order: { side: "sell", type: "limit", size: 1, price: 100 },
    previousClose: 110,
    nextOpen: 120,
    expected: { price: 120, liquiditySide: "taker" },
  },
  {
    description: "sell stop crossing down-to-up",
    order: { side: "sell", type: "stop", size: 1, price: 100 },
    previousClose: 90,
    nextOpen: 110,
    expected: null,
  },
  {
    description: "sell stop crossing up-to-down",
    order: { side: "sell", type: "stop", size: 1, price: 100 },
    previousClose: 110,
    nextOpen: 90,
    expected: { price: 90, liquiditySide: "taker" },
  },
  {
    description: "sell stop already executable on both sides of the gap",
    order: { side: "sell", type: "stop", size: 1, price: 100 },
    previousClose: 90,
    nextOpen: 80,
    expected: { price: 80, liquiditySide: "taker" },
  },
])("gap handling: $description", ({ expected, ...args }) => {
  const result = handleGapOrder(args);
  const fills = result.asset.transactions.map(({ price, liquiditySide }) => ({
    price,
    liquiditySide,
  }));

  expect(fills).toEqual(expected ? [expected] : []);
});

it("fills an attached stop at the open after its entry limit fills within the gap", () => {
  const result = handleGapOrder({
    order: { side: "buy", type: "limit", size: 1, price: 100 },
    previousClose: 110,
    nextOpen: 90,
    stopLoss: 95,
  });

  expect(
    result.asset.transactions.map(({ side, price, liquiditySide }) => ({
      side,
      price,
      liquiditySide,
    }))
  ).toEqual([
    { side: "buy", price: 100, liquiditySide: "maker" },
    { side: "sell", price: 90, liquiditySide: "taker" },
  ]);
});

it("should store initial stop loss for a completed short trade", () => {
  const result = handleOrdersWithoutCommission({
    symbol: "foo",
    series: [redCandle],
    position: null,
    entryOrder: { side: "sell", type: "limit", size: 2, price: 60 },
    stopLoss: 70,
    takeProfit: 30,
    initialStopLoss: null,
    bufferSize: 100,
    data: {},
    transactions: [],
    trades: [],
  });

  const trade = result.asset.trades[0];
  expect(trade.initialStopLoss).toBe(70);
  expect(getInitialRisk(trade)).toBe(20);
});

it("should return null initial risk when a trade had no initial stop loss", () => {
  const result = handleOrdersWithoutCommission({
    symbol: "foo",
    series: [greenCandle],
    position: null,
    entryOrder: { side: "buy", type: "limit", size: 2, price: 40 },
    stopLoss: null,
    takeProfit: 70,
    initialStopLoss: null,
    bufferSize: 100,
    data: {},
    transactions: [],
    trades: [],
  });

  const trade = result.asset.trades[0];
  expect(trade.initialStopLoss).toBeNull();
  expect(getInitialRisk(trade)).toBeNull();
});

it("should keep the initial stop loss after the stop loss is updated", () => {
  const firstCandle: Candle = {
    open: 100,
    close: 100,
    low: 100,
    high: 100,
    volume: 100,
    time: 1,
  };
  const secondCandle: Candle = {
    open: 100,
    close: 110,
    low: 100,
    high: 110,
    volume: 100,
    time: 2,
  };

  const entryResult = handleOrdersWithoutCommission({
    symbol: "foo",
    series: [firstCandle],
    position: null,
    entryOrder: { side: "buy", type: "market", size: 2 },
    stopLoss: 90,
    takeProfit: 120,
    initialStopLoss: null,
    bufferSize: 100,
    data: {},
    transactions: [],
    trades: [],
  });

  const exitResult = handleOrdersWithoutCommission({
    ...entryResult.asset,
    series: [secondCandle],
    stopLoss: 95,
    takeProfit: 110,
  });

  const trade = exitResult.asset.trades[0];
  expect(trade.initialStopLoss).toBe(90);
  expect(getInitialRisk(trade)).toBe(20);
});
