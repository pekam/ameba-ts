import _ from "lodash";
import { backtestStrategy } from "../core/backtest";
import { allInStaker, withStaker } from "../core/staker";
import { CandleSeries } from "../core/types";
import { readDataFromFile, writeDataToFile } from "../data/data-caching";
import { m } from "../shared/functions";
import {
  PERIODS,
  timestampFromUTC,
  toDateString,
  toTimestamp,
} from "../shared/time-util";
import { autoOptimizer } from "../strats/auto-optimizer";
import { donchianBreakoutStrategy } from "../strats/donchian-breakout-strat";
import { macdStrat } from "../strats/macd-strat";
import { getFtxClient } from "./ftx";
import { getFtxUtil } from "./ftx-util";
import { emaStrat, getBacktestableStrategy, getEmaStrat } from "./strats";

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
    (c) => c.time > toTimestamp("2021-05-01")
  );

  const stratPool = [
    () =>
      macdStrat({
        relativeTakeProfit: 0.015,
        relativeStopLoss: 0.01,
        onlyDirection: "short",
      }),
    () =>
      macdStrat({
        relativeTakeProfit: 0.015,
        relativeStopLoss: 0.01,
        onlyDirection: "long",
      }),
    () =>
      macdStrat({
        relativeTakeProfit: 0.015,
        relativeStopLoss: 0.01,
      }),
    () => getBacktestableStrategy(emaStrat, false),
  ];

  const stratProvider = () =>
    withStaker(
      autoOptimizer({
        stratPool,
        optimizeInterval: PERIODS.day * 2,
        optimizePeriod: PERIODS.day * 2,
      }),
      allInStaker
    );

  const res = backtestStrategy({ stratProvider, series: candles });
  // const withTransCost = withRelativeTransactionCost(res, 0.0007);
  save(
    { res: res.stats, withTransCost: res.stats },
    "eth-macd-auto-optimized.json"
  );

  return;

  const randomOptimize = () => {
    const results = m.sortAscending(
      m.range(20).map(() => {
        const channelPeriod = _.random(100, 1000);
        const smaPeriod = _.random(20, 100);
        const result = backtestStrategy({
          stratProvider: () =>
            withStaker(
              donchianBreakoutStrategy({
                channelPeriod,
                smaPeriod,
                onlyDirection: "long",
              }),
              allInStaker
            ),
          series: candles,
        });
        // const withCosts = withRelativeTransactionCost(result, 0.0007);
        return {
          ...result.stats,
          channelPeriod,
          smaPeriod,
        };
      }),
      (r) => r.relativeProfit
    );
    console.log(results);
    /*
     * channelPeriod: 567
     * smaPeriod: 93
     */
  };

  return;

  const candleSeries = await util.getCandles({
    startDate: "2021-02-20",
    endDate: "2021-06-01",
    resolution: "1min",
  });

  candleSeries.forEach((c, i, a) => {
    if (i > 0) {
      const prev = a[i - 1];
      const diff = c.time - prev.time;
      if (diff !== 60) {
        console.error("diff " + diff + " index " + i);
        console.log(toDateString(c.time));
        console.log(toDateString(prev.time));
      }
    }
  });
  console.log(candleSeries.length / 24 / 60);
  console.log(toDateString(candleSeries[0].time));
  console.log(toDateString(m.last(candleSeries).time));

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

  const backtestResult = backtestStrategy({
    stratProvider: () => getBacktestableStrategy(getEmaStrat(5, 20), true),
    series,
  });

  console.log(backtestResult.stats);
  // const resultWithTransactionCosts = withRelativeTransactionCost(
  //   backtestResult,
  //   0.0005
  // );
  // console.log(resultWithTransactionCosts.stats);
  console.log(toDateString(series[0].time), toDateString(m.last(series).time));
}
run();
