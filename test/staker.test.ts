import { mapValues } from "remeda";
import {
  AssetState,
  backtestSync,
  createStaker,
  TradingStrategy,
  Transaction,
  withStaker,
} from "../src";
import { Dictionary } from "../src/util/type-util";
import { testData } from "./test-data/testData";

it("should set position sizes by max risk per trade and max exposure", () => {
  const initialBalance = 100;
  const maxRelativeRisk = 0.2;
  const maxRelativeExposure = 0.5;
  const entryPrice = 2;
  const stopLoss = 1;

  const symbols = ["foo", "bar"];

  const expectedPositionSizes = {
    // foo is limited by maxRelativeRisk
    foo: 20,
    // foo already uses $40, and max exposure is $50, so bar has only $10 to use
    bar: 5,
  };

  const series = {
    [symbols[0]]: testData.getSimpleTestData(3),
    [symbols[1]]: testData.getSimpleTestData(3),
  };

  const staker = createStaker({
    maxRelativeRisk,
    maxRelativeExposure,
    allowFractions: false,
  });

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
});
