import { backtestStrategy } from "../core/backtest";
import { CandleSeries } from "../core/types";
import { m } from "../shared/functions";
import { PERIODS } from "../shared/time-util";
import { donchianBreakoutStrategy } from "../strats/donchian-breakout-strat";
import { botB } from "./bot-b";
import { FtxMarket, getFtxClient } from "./ftx";
import { getFtxUtil } from "./ftx-util";

(async function () {
  const subaccount = "bot-4";
  const market: FtxMarket = "FTT/USD";

  const backtestInterval = PERIODS.day / 2;
  const backtestPeriod = backtestInterval;

  const ftxUtil = getFtxUtil({
    ftx: getFtxClient({ subaccount }),
    market,
  });

  const stratProvider = () =>
    donchianBreakoutStrategy({
      channelPeriod: 100,
      smaPeriod: 100,
      onlyDirection: "long",
      maxRelativeStopLoss: 0.02,
      maxAtrStoploss: 5,
    });

  function getStaker() {
    let lastBacktested: number | null = null;

    let backtestResult: number | null = null;

    function backtest(series: CandleSeries) {
      const endTime = m.last(series).time;
      const from = endTime - backtestPeriod;
      const result = backtestStrategy(stratProvider, series, true, from);
      lastBacktested = endTime;
      backtestResult = result.stats.result;
      console.log("BACKTEST FINISHED with result " + backtestResult);
    }

    return function (balance: number, series: CandleSeries) {
      if (
        !lastBacktested ||
        m.last(series).time - lastBacktested > backtestInterval
      ) {
        backtest(series);
      }

      if (backtestResult !== null && backtestResult > 1.005) {
        return balance * 3;
      } else {
        return balance;
      }
    };
  }

  await botB.run({
    ftxUtil,
    resolution: "1min",
    stratProvider,
    requiredCandles: backtestPeriod / PERIODS.minute + PERIODS.hour,
    stakerProvider: getStaker,
  });
})();
