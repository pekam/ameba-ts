import { mapToObj, mapValues } from "remeda";
import {
  AssetState,
  backtestSync,
  createStaker,
  Staker,
  TradingStrategy,
  Transaction,
  withStaker,
} from "../src";
import { Dictionary } from "../src/util/type-util";
import { testData } from "./test-data/testData";

function testStaker({
  staker,
  symbols,
  expectedPositionSizes,
}: {
  symbols: string[];
  staker: Staker;
  expectedPositionSizes: Dictionary<number>;
}) {
  const initialBalance = 100;
  const entryPrice = 2;
  const stopLoss = 1;

  const series = mapToObj(symbols, (symbol) => [
    symbol,
    testData.getSimpleTestData(3),
  ]);

  let entryTransactions: Dictionary<Transaction> = {};
  const strategy: TradingStrategy = (state: AssetState) => {
    if (!state.position) {
      return {
        entryOrder: {
          type: "stop",
          side: "buy",
          price: entryPrice,
        },
        stopLoss,
      };
    } else {
      if (!Object.keys(entryTransactions).includes(state.symbol)) {
        expect(state.transactions.length).toBe(1);
        entryTransactions[state.symbol] = state.transactions[0];
      }
      return {};
    }
  };
  backtestSync({
    strategy: withStaker(strategy, staker),
    series,
    initialBalance,
  });

  expect(mapValues(entryTransactions, (t) => t.size)).toEqual(
    expectedPositionSizes
  );
}

it("should set position sizes by max risk per trade and max exposure", () => {
  const staker = createStaker({
    maxRelativeRisk: 0.2,
    maxRelativeExposure: 0.5,
    allowFractions: false,
  });

  const symbols = ["foo", "bar"];

  const expectedPositionSizes = {
    // foo is limited by maxRelativeRisk
    foo: 20,
    // foo already uses $40, and max exposure is $50, so bar has only $10 to use
    bar: 5,
  };

  testStaker({ staker, symbols, expectedPositionSizes });
});

it("should set position sizes by max absolute risk when < relative risk", () => {
  const staker = createStaker({
    maxRelativeRisk: 0.2,
    maxRelativeExposure: 1,
    maxAbsoluteRisk: 10,
    allowFractions: false,
  });

  const symbols = ["foo"];

  const expectedPositionSizes = {
    // limited by maxAbsoluteRisk
    foo: 10,
  };

  testStaker({ staker, symbols, expectedPositionSizes });
});

it("should set position sizes by max relative risk when < absolute risk", () => {
  const staker = createStaker({
    maxRelativeRisk: 0.2,
    maxRelativeExposure: 1,
    maxAbsoluteRisk: 50,
    allowFractions: false,
  });

  const symbols = ["foo"];

  const expectedPositionSizes = {
    // limited by maxRelativeRisk
    foo: 20,
  };

  testStaker({ staker, symbols, expectedPositionSizes });
});
