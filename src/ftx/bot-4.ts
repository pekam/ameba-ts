import { FtxMarket } from "./ftx";
import { runFtxBot } from "./bot";
import { getFtxMarketMaker } from "./market-maker-orders";
import { getEmaStrat } from "./strats";

(async function () {
  const subaccount = "bot-4";
  const market: FtxMarket = "BTC/USD";
  const { enter, exit } = getFtxMarketMaker({ subaccount, market });

  await runFtxBot({
    subaccount,
    market,
    strat: getEmaStrat(2, 5),
    resolution: "1min",
    candleSeriesLookBack: 60 * 60 * 6, // 6h
    safeZoneMargin: 0.0005,
    enter,
    exit,
  });
})();
