import { loadCandles } from "../src/core/load-data";
import { Order, Strategy, TradeState } from "../src/core/types";
import { backtestStrategy } from "../src/core/backtest";
import { CandleSeries } from "../src/core/candle-series";
import { timestampFromUTC } from "../src/core/date-util";
import { BacktestResult } from "../src/core/backtest-result";

it("should get end balance from backtest", async () => {
  expect.assertions(1);

  const strat: Strategy = {
    init(state: TradeState): void {},
    update(state) {
      const newCandle = state.series.last;
      if (!state.position) {
        if (newCandle.close > newCandle.open) {
          const entryOrder: Order = {
            type: "limit",
            price: newCandle.high,
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

  const result: BacktestResult = backtestStrategy(
    strat,
    series,
    timestampFromUTC(2020, 3, 4, 5),
    timestampFromUTC(2020, 3, 4, 6)
  );

  expect(result.result).toBe(0.9997060970954589);
});
