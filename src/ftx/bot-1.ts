import { runFtxBot } from "./bot";
import { getEmaStrat } from "./strats";
import { getFtxMarketMaker } from "./market-maker-orders";
import { FtxMarket } from "./ftx";

(async function () {
  const subaccount = "bot";
  const market: FtxMarket = "BTC/USD";
  const { enter, exit } = getFtxMarketMaker({ subaccount, market });

  await runFtxBot({
    subaccount,
    market,
    strat: getEmaStrat(2, 50),
    resolution: "1h",
    candleSeriesLookBack: 60 * 60 * 120, // 120h
    safeZoneMargin: 0.002,
    enter,
    exit,
  });
})();
