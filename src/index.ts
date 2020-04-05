import { loadForexCandles, Candle } from "./loadData";
import { Strategy, Order, Transaction } from "./strategy";
import { backtestStrategy } from "./backtest";

const strat: Strategy = state => {
  const newCandle = state.series.last;
  if (!state.position) {
    if (newCandle.close > newCandle.open) {
      const entryOrder: Order = {
        type: 'limit',
        price: newCandle.high
      }
      return {
        entryOrder,
        stopLoss: newCandle.high * 0.9999,
        takeProfit: newCandle.high * 1.0001
      }
    } else {
      return {
        entryOrder: null,
        stopLoss: null,
        takeProfit: null
      }
    }
  } else {
    return {};
  }
}

loadForexCandles({
  symbol: 'OANDA:EUR_USD',
  // symbol: 'FXCM:EUR/USD',
  // symbol: 'FXPRO:1',
  resolution: '1',
  from: Date.UTC(2020, 2, 4),
  to: Date.UTC(2020, 2, 5)
})

  .then(series => {

    const result: Transaction[] =
      backtestStrategy(strat, series,
        Date.UTC(2020, 2, 4, 5),
        Date.UTC(2020, 2, 4, 6));

    console.log(result);

    let balance = 1000;
    result.forEach((transaction, i) => {
      if (transaction.order.sell) {
        const prev = result[i - 1];
        const tradeProfit = transaction.price / prev.price;
        balance *= tradeProfit;
        console.log(tradeProfit);
      };
    });
    console.log('end balance: ' + balance);
  })

  .catch(err => {
    console.error('Failed to get forex candles:\n', err)
  })
