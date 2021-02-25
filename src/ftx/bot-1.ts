import { runFtxBot } from "./bot";
import { emaStrat } from "./strats";
import { getFtxMarketMaker } from "./market-maker-orders";
import { FtxMarket } from "./ftx";

(async function () {
  const subaccount = "bot";
  const market: FtxMarket = "BTC/USD";
  const { enter, exit } = getFtxMarketMaker({ subaccount, market });

  await runFtxBot({
    subaccount,
    market,
    strat: emaStrat,
    resolution: "1min",
    candleSeriesLookBack: 60 * 60 * 6, // 6h
    safeZoneMargin: 0.002,
    enter,
    exit,
  });
})();
