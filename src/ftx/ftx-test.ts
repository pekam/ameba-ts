import { backtestStrategy } from "../core/backtest";
import { withRelativeTransactionCost } from "../core/backtest-result";
import { getFtxClient } from "./ftx";
import { timestampFromUTC, timestampToUTCDateString } from "../core/date-util";
import { m } from "../functions/functions";
import { emaStrat, getBacktestableStrategy, getEmaStrat } from "./strats";
import { getFtxUtil } from "./ftx-util";
import { readDataFromFile, writeDataToFile } from "../data/data-caching";
import { CandleSeries } from "../core/types";
import { DonchianBreakoutStrategy } from "../strats/donchian-breakout-strat";
import { MacdStrat } from "../strats/macd-strat";
import { AutoOptimizer } from "../strats/auto-optimizer";
import { PERIODS } from "../util";
import _ = require("lodash");

async function run() {
  const ftx = getFtxClient({ subaccount: "bot-2" });

  const util = getFtxUtil({ ftx, market: "ETH/USD" });

  const save = writeDataToFile;
  const load = readDataFromFile;

  const candles: CandleSeries = load("eth.json");

  // console.log(
  //   m
  //     .combineMinuteToHourlyCandles(candles.slice(-240))
  //     .map((c) => ({ ...c, t: timestampToUTCDateString(c.time) }))
  // );
  // return;

  const recentCandles = candles.filter(
    (c) => c.time > m.dateStringToTimestamp("2021-05-01")
  );

  const stratPool = [
    () =>
      new MacdStrat({
        relativeTakeProfit: 0.015,
        relativeStopLoss: 0.01,
        onlyDirection: "short",
      }),
    () =>
      new MacdStrat({
        relativeTakeProfit: 0.015,
        relativeStopLoss: 0.01,
        onlyDirection: "long",
      }),
    () =>
      new MacdStrat({
        relativeTakeProfit: 0.015,
        relativeStopLoss: 0.01,
      }),
    () => getBacktestableStrategy(emaStrat, false),
  ];

  const stratProvider = () =>
    new AutoOptimizer({
      stratPool,
      optimizeInterval: PERIODS.day * 2,
      optimizePeriod: PERIODS.day * 2,
    });

  const res = await backtestStrategy(stratProvider, candles);
  const withTransCost = withRelativeTransactionCost(res, 0.0007);
  save(
    { res: res.stats, withTransCost: withTransCost.stats },
    "eth-macd-auto-optimized.json"
  );

  return;

  const randomOptimize = () => {
    const results = m.sortAscending(
      m.range(20).map(() => {
        const channelPeriod = _.random(100, 1000);
        const smaPeriod = _.random(20, 100);
        const result = backtestStrategy(
          () => new DonchianBreakoutStrategy(channelPeriod, smaPeriod),
          candles
        );
        const withCosts = withRelativeTransactionCost(result, 0.0007);
        return {
          ...withCosts.stats,
          channelPeriod,
          smaPeriod,
        };
      }),
      (r) => r.averageProfit
    );
    console.log(results);
    /*
     * channelPeriod: 567
     * smaPeriod: 93
     */
  };

  return;

  const candleSeries = await util.getMinuteCandles({
    startDate: "2021-02-20",
    endDate: "2021-06-01",
  });

  candleSeries.forEach((c, i, a) => {
    if (i > 0) {
      const prev = a[i - 1];
      const diff = c.time - prev.time;
      if (diff !== 60) {
        console.error("diff " + diff + " index " + i);
        console.log(timestampToUTCDateString(c.time));
        console.log(timestampToUTCDateString(prev.time));
      }
    }
  });
  console.log(candleSeries.length / 24 / 60);
  console.log(timestampToUTCDateString(candleSeries[0].time));
  console.log(timestampToUTCDateString(m.last(candleSeries).time));

  save(candleSeries, "btc.json");

  return;

  const profits = await util.getRecentTradeProfits();

  console.log(profits);
  console.log(profits.length);

  console.log(m.avg(profits));
  console.log(m.sum(profits));

  console.log(m.getWeightedAverage(profits));

  return;

  const series = await ftx.getCandles({
    market: "SUSHI/USD",
    resolution: "1min",
    startTime: timestampFromUTC(2021, 3, 1),
    endTime: timestampFromUTC(2021, 3, 4),
  });

  const backtestResult = backtestStrategy(
    () => getBacktestableStrategy(getEmaStrat(5, 20), true),
    series
  );

  console.log(backtestResult.stats);
  const resultWithTransactionCosts = withRelativeTransactionCost(
    backtestResult,
    0.0005
  );
  console.log(resultWithTransactionCosts.stats);
  console.log(
    timestampToUTCDateString(series[0].time),
    timestampToUTCDateString(m.last(series).time)
  );
}
run();
