import { loadCandles } from "./core/load-data";
import { timestampFromUTC } from "./core/date-util";
import { backtestStrategy } from "./core/backtest";
import { rsiDivergenceStrategy } from "./strats/rsi-divergence-strat";

loadCandles({
  // market: "forex",
  // symbol: "OANDA:EUR_USD",
  market: "stock",
  symbol: "AMZN",
  resolution: "60",
  from: timestampFromUTC(2020, 5, 1),
  to: timestampFromUTC(2020, 7, 31),
})
  .then((series) => {
    const result = backtestStrategy(
      rsiDivergenceStrategy,
      series,
      series[0].time
    );

    console.log(result);
  })

  .catch(console.error);
