import { backtestStrategy } from "./core/backtest";
import { getDataSet } from "./data/load-data-set";
import { donchianBreakoutStrategy } from "./strats/donchian-breakout-strat";
import { tradeOnlyRecentlyProfitable } from "./strats/trade-only-recently-profitable";

// index.ts contains random testing stuff that changes all the time

(async () => {
  const dataSet = await getDataSet("makkara");
  const companiesWithCandles = await Promise.all(
    dataSet.companies.slice(0, 30).map((comp) => comp.withCandleSeries())
  );
  const result = backtestStrategy({
    stratProvider: () =>
      tradeOnlyRecentlyProfitable(() =>
        donchianBreakoutStrategy({
          channelPeriod: 30,
          smaPeriod: 20,
          onlyDirection: "long",
        })
      ),
    series: companiesWithCandles[0].candles,
  });
  console.log(result);
})();
