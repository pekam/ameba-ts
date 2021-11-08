import { backtestStrategy } from "../core/backtest";
import { CandleSeries } from "../core/types";
import { m } from "../shared/functions";
import { PERIODS } from "../shared/time-util";
import { donchianBreakoutStrategy } from "../strats/donchian-breakout-strat";
import { runFtxBot } from "./bot";
import { botB } from "./bot-b";
import { FtxMarket, getFtxClient } from "./ftx";
import { getFtxStaker } from "./ftx-staker";
import { getFtxUtil } from "./ftx-util";
import { getFtxMarketMaker } from "./market-maker-orders";
import { emaStrat } from "./strats";

/*
Examples for running bots in FTX.

The first example uses the simple bot where strategies simply return a boolean
to indicate whether to be long or not, and the buys and sells are executed by
keeping a best bid/ask in the orderbook and waiting for someone to take them
(to take advantage of FTX's 0 trading fees for market maker orders).

The second bot runs botB, which integrates with this project's Strategy type. It
uses stop and limit orders as defined by the strategy, so some limit orders might
be market maker (0 fees), but mostly you shouldn't count on that.

properties.json must contain entries for these subaccounts, e.g.
{
  "ftx": [
    {
      "subaccount": "bot-2",
      "api_key": "...",
      "s": "...",
      "peak": 3450
    },
    {
      "subaccount": "bot-4",
      "api_key": "...",
      "s": "..."
    }
  ]
}
*/

async function botExample() {
  const subaccount = "bot-2";
  const market: FtxMarket = "FTT/USD";

  const strat = emaStrat;

  const { enter, exit } = getFtxMarketMaker({
    subaccount,
    market,
    staker: getFtxStaker({
      subaccount,
      market,
      stakeByPeakAccountValue: true,
      stratIfStakingByBacktest: strat,
    }),
  });

  await runFtxBot({
    subaccount,
    market,
    strat,
    resolution: "1min",
    candleSeriesLookBack: PERIODS.hour * 18,
    safeZoneMargin: 0.002,
    enter,
    exit,
  });
}

async function botBExample() {
  const subaccount = "bot-4";
  const market: FtxMarket = "SHIB/USD";

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

      if (backtestResult === null || backtestResult < 1.003) {
        return 0;
      } else if (backtestResult < 1.005) {
        return balance;
      } else {
        return balance * 3;
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
}
