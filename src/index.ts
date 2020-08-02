import { loadCandles } from "./core/load-data";
import { timestampFromUTC } from "./core/date-util";
import { backtestStrategy } from "./core/backtest";
import { donchianChannelStrategy } from "./strats/donchian-channel-strat";

loadCandles({
  market: "forex",
  symbol: "OANDA:EUR_USD",
  // market: "stock",
  // symbol: "AMZN",
  resolution: "60",
  from: timestampFromUTC(2020, 1, 1),
  to: timestampFromUTC(2020, 7, 31),
})
  .then((series) => {
    const result = backtestStrategy(
      donchianChannelStrategy,
      series,
      series[30].time
    );

    console.log(result);
  })

  .catch(console.error);
