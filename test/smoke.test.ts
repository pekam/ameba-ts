import { backtestStrategy } from "../src/core/backtest";
import { BacktestResult } from "../src/core/backtest-result";
import { CandleSeries, Order, Strategy, TradeState } from "../src/core/types";
import { m } from "../src/shared/functions";
import { PERIODS, timestampFromUTC } from "../src/shared/time-util";
import { testData } from "./test-data/testData";

it("should produce a backtest result", () => {
  const strat: Strategy = (state: TradeState) => {
    const newCandle = m.last(state.series);
    if (!state.position) {
      if (newCandle.close > newCandle.open) {
        const entryPrice = newCandle.high;
        const entryOrder: Order = {
          type: "stop",
          price: entryPrice,
          side: "buy",
          size: state.cash / entryPrice,
        };
        return {
          entryOrder,
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

  const series: CandleSeries = testData.getBtcHourly();

  const backtestRange = {
    from: timestampFromUTC(2021, 10, 2),
    to: timestampFromUTC(2021, 10, 8),
  };

  const result: BacktestResult = backtestStrategy({
    stratProvider: () => strat,
    series,
    ...backtestRange,
    initialBalance: 100,
  });

  // This is basically a snapshot test
  expect(result.stats.endBalance).toBe(103.966784092104632);
  expect(result.stats.relativeProfit).toBe(0.03966784092104632);
  expect(result.stats.tradeCount).toBe(22);

  expect(result.stats.range.from).toBe(backtestRange.from);
  expect(result.stats.range.to).toBe(backtestRange.to - PERIODS.hour);
});
