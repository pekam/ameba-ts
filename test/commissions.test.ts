import { flatMap } from "remeda";
import { backtest, CommissionProvider, FullTradingStrategy } from "../src";
import { last } from "../src/util/util";
import { testData } from "./test-data/testData";

it("should charge commissions by the commission provider", () => {
  const symbol = "foo";

  const series = {
    [symbol]: testData.getSimpleTestData(3),
  };

  const commissionProvider: CommissionProvider = (transaction) =>
    transaction.size * 0.01;

  const cashBalances: number[] = [];

  const strategy: FullTradingStrategy = (state) => {
    cashBalances.push(state.cash);

    const asset = state.assets[symbol];
    const candle = last(asset.series);
    if (!asset.position) {
      return {
        [symbol]: {
          entryOrder: {
            side: "buy",
            type: "limit",
            price: candle.close + 1, // basically a market order
            size: 100,
          },
          takeProfit: candle.close + 0.5,
        },
      };
    } else {
      return { [symbol]: {} };
    }
  };

  const result = backtest({
    series,
    strategy,
    commissionProvider,
    initialBalance: 100,
  });

  // $50 profit per trade, $1 commission per transaction
  expect(cashBalances).toEqual([100, 148, 196]);

  // Check that the transactions include the commissions
  const transactions = flatMap(result.trades, (t) => [t.entry, t.exit]);
  expect(transactions.map((t) => t.commission)).toEqual([1, 1, 1, 1]);

  // Check also that the trade profits take the commissions into account
  expect(result.trades.map((t) => t.absoluteProfit)).toEqual([48, 48]);
  expect(result.trades.map((t) => t.relativeProfit)).toEqual([
    48 / 200,
    48 / 300,
  ]);
});
