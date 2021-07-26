import { backtestStrategy } from "../src/core/backtest";
import { BacktestResult } from "../src/core/backtest-result";
import { timestampFromUTC } from "../src/core/date-util";
import { CandleSeries, Order, Strategy, TradeState } from "../src/core/types";
import { loadCandles } from "../src/data/load-candle-data";
import { m } from "../src/shared/functions";
import { PERIODS } from "../src/shared/periods";

it("should get end balance from backtest", async () => {
  expect.assertions(3);

  const strat: Strategy = {
    init(state: TradeState): void {},
    update(state) {
      const newCandle = m.last(state.series);
      if (!state.position) {
        if (newCandle.close > newCandle.open) {
          const entryOrder: Order = {
            type: "limit",
            price: newCandle.high,
            side: "buy",
          };
          return {
            entryOrder,
            stopLoss: newCandle.high * 0.9999,
            takeProfit: newCandle.high * 1.0001,
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
    },
  };

  const series: CandleSeries = await loadCandles({
    market: "forex",
    symbol: "OANDA:EUR_USD",
    resolution: "1",
    from: timestampFromUTC(2020, 3, 4),
    to: timestampFromUTC(2020, 3, 5),
  });

  const backtestRange = {
    from: timestampFromUTC(2020, 3, 4, 5),
    to: timestampFromUTC(2020, 3, 4, 6),
  };

  const result: BacktestResult = backtestStrategy(
    () => strat,
    series,
    true,
    backtestRange.from,
    backtestRange.to
  );

  expect(result.stats.result).toBe(0.9997060970954589);

  expect(result.stats.range.from).toBe(backtestRange.from);
  expect(result.stats.range.to).toBe(backtestRange.to - PERIODS.minute);
});
