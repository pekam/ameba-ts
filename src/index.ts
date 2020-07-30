import { loadCandles } from "./loadData";
import { Strategy, Order, Trade } from "./types";
import { backtestStrategy } from "./backtest";
import { timestampFromUTC } from "./dateUtil";
import { addRSI, addSMA } from "./indicators";

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
  market: "forex",
  symbol: "OANDA:EUR_USD",
  // symbol: 'FXCM:EUR/USD',
  // symbol: 'FXPRO:1',
  resolution: "1",
  from: timestampFromUTC(2020, 2, 4),
  to: timestampFromUTC(2020, 2, 5),
})
  .then((series) => {
    addSMA(series, 3);
    addRSI(series, 4);

    console.log(series.slice(0, 5));
  })

  .catch(console.error);
