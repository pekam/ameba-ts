import { loadCandles } from "../src/core/load-data";
import { Strategy, Order, Trade } from "../src/core/types";
import { backtestStrategy } from "../src/core/backtest";
import { CandleSeries } from "../src/core/candle-series";
import { timestampFromUTC } from "../src/core/date-util";
import { addRSI, addSMA } from "../src/core/indicators";

it("should get end balance from backtest", async () => {
  expect.assertions(1);

  const strat: Strategy = (state) => {
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
  };

  const series: CandleSeries = await loadCandles({
    market: "forex",
    symbol: "OANDA:EUR_USD",
    resolution: "1",
    from: timestampFromUTC(2020, 3, 4),
    to: timestampFromUTC(2020, 3, 5),
  });

  const result: Trade[] = backtestStrategy(
    strat,
    series,
    timestampFromUTC(2020, 3, 4, 5),
    timestampFromUTC(2020, 3, 4, 6)
  );

  let balance = 1000;
  result.forEach((trade) => {
    balance *= 1 + trade.profit;
  });

  expect(balance).toBe(999.600040003999);
});