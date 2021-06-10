import { FtxMarket } from "./ftx";
import { runFtxBot } from "./bot";
import { getFtxMarketMaker } from "./market-maker-orders";
import { getEmaStrat } from "./strats";
import { getFtxStaker } from "./ftx-staker";

(async function () {
  const subaccount = "bot-4";
  const market: FtxMarket = "FTT/USD";
  const { enter, exit } = getFtxMarketMaker({
    subaccount,
    market,
    staker: getFtxStaker({
      subaccount,
      market,
      stakeByPeakAccountValue: false,
    }),
  });
  // const util = getFtxUtil({ ftx: getFtxClient({ subaccount }), market });
  // const marketOrders = getFtxMarketOrders(util);

  await runFtxBot({
    subaccount,
    market,
    strat: getEmaStrat(2, 5),
    resolution: "1min",
    candleSeriesLookBack: 60 * 60 * 6, // 6h
    safeZoneMargin: 0.0005,
    enter,
    exit,
    // loopMs: 60 * 1000,
  });
})();
