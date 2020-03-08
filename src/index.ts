import { loadForexCandles, Candle } from "./loadData";

loadForexCandles({
  // symbol: 'OANDA:EUR_USD',
  // symbol: 'FXCM:EUR/USD',
  symbol: 'FXPRO:1',
  resolution: 'D',
  from: new Date('March 2 2020'),
  to: new Date()
}).then(console.log);
