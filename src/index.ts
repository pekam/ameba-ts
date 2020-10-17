import { getDataSet } from "./data/load-data-set";
import { backtestStrategy } from "./core/backtest";
import { RsiReversalStrategy } from "./strats/RsiReversalStrat";

// index.ts contains random testing stuff that changes all the time

(async () => {
  const dataSet = await getDataSet("makkara");
  const company = await dataSet.companies[5].withCandleSeries();
  console.log(company.symbol);
  const result = backtestStrategy(new RsiReversalStrategy(), company.candles);
  console.log(result);
})();
