import { getDataSet } from "./data/load-data-set";
import { backtestMultiple } from "./core/backtest-multiple";
import { DonchianBreakoutStrategy } from "./strats/donchian-breakout-strat";
import { TradeOnlyRecentlyProfitable } from "./strats/trade-only-recently-profitable";

// index.ts contains random testing stuff that changes all the time

(async () => {
  const dataSet = await getDataSet("makkara");
  const companiesWithCandles = await Promise.all(
    dataSet.companies.slice(0, 30).map((comp) => comp.withCandleSeries())
  );
  const result = backtestMultiple(
    () =>
      new TradeOnlyRecentlyProfitable(
        () => new DonchianBreakoutStrategy(30, 20)
      ),
    companiesWithCandles.map((c) => c.candles)
  );
  console.log(result);
})();
