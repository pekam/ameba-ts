import { runFtxBot } from "./bot";
import { getEmaStrat } from "./strats";
import { getFtxMarketMaker } from "./market-maker-orders";
import { FtxMarket } from "./ftx";
import { getFtxStaker } from "./ftx-staker";

(async function () {
  const subaccount = "bot";
  const market: FtxMarket = "BTC/USD";

  const strat = getEmaStrat(2, 50);

  const { enter, exit } = getFtxMarketMaker({
    subaccount,
    market,
    staker: getFtxStaker({
      subaccount,
      market,
      stakeByPeakAccountValue: false,
    }),
  });

  await runFtxBot({
    subaccount,
    market,
    strat,
    resolution: "1h",
    candleSeriesLookBack: 60 * 60 * 120, // 120h
    safeZoneMargin: 0.002,
    enter,
    exit,
  });
})();
