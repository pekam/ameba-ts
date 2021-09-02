import { PERIODS } from "../shared/time-util";
import { runFtxBot } from "./bot";
import { FtxMarket } from "./ftx";
import { getFtxStaker } from "./ftx-staker";
import { getFtxMarketMaker } from "./market-maker-orders";
import { tripleEmaStrat } from "./strats";

(async function () {
  const subaccount = "bot-3";
  const market: FtxMarket = "FTT/USD";
  const strat = tripleEmaStrat;

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
})();
