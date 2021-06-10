import { runFtxBot } from "./bot";
import { emaStrat } from "./strats";
import { FtxMarket } from "./ftx";
import { getFtxMarketMaker } from "./market-maker-orders";
import { getFtxStaker } from "./ftx-staker";

(async function () {
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
    }),
  });

  await runFtxBot({
    subaccount,
    market,
    strat,
    resolution: "1min",
    candleSeriesLookBack: 60 * 60 * 6, // 6h
    safeZoneMargin: 0.002,
    enter,
    exit,
  });
})();
