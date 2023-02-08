import { omit, pipe } from "remeda";
import { AssetState, Candle } from "../src";
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
