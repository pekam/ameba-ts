import { loadCandles } from "./core/load-data";
import { Strategy, Order, Trade } from "./core/types";
import { backtestStrategy } from "./core/backtest";
import { timestampFromUTC } from "./core/date-util";
import { addRSI, addSMA } from "./core/indicators";

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

loadCandles({
  market: "stock",
  symbol: "AMZN",
  resolution: "D",
  from: timestampFromUTC(2020, 6, 1),
  to: timestampFromUTC(2020, 7, 1),
})
  .then((series) => {
    addSMA(series, 3);
    addRSI(series, 4);

    console.log(series.slice(0, 5));
  })

  .catch(console.error);
