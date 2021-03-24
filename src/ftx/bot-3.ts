import { runFtxBot } from "./bot";
import { tripleEmaStrat } from "./strats";
import { FtxMarket } from "./ftx";
import { getFtxMarketMaker } from "./market-maker-orders";

(async function () {
  const subaccount = "bot-3";
  const market: FtxMarket = "FTT/USD";
  const { enter, exit } = getFtxMarketMaker({
    subaccount,
    market,
    peakAccountValueIfUsingRiskManagement: 166.8,
  });

  await runFtxBot({
    subaccount,
    market,
    strat: tripleEmaStrat,
    resolution: "1min",
    candleSeriesLookBack: 60 * 60 * 6, // 6h
    safeZoneMargin: 0.002,
    enter,
    exit,
  });
})();
