import { loadForexCandles, Candle } from "./loadData";

loadForexCandles({
  // symbol: 'OANDA:EUR_USD',
  symbol: 'FXCM:EUR/USD',
  // symbol: 'FXPRO:1',
  resolution: '60',
  from: Date.UTC(2020, 2, 4),
  to: Date.UTC(2020, 2, 5)
})

  .then(candles => {
    console.log(candles)
  })

  .catch(err => {
    console.error('Failed to get forex candles:\n', err)
  })
