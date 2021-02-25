import { FtxMarket } from "./ftx";
import { runFtxBot } from "./bot";
import { tripleEmaStrat } from "./strats";
import { getFtxUtil } from "./ftx-util";

(async function () {
  const subaccount = "bot-4";
  const market: FtxMarket = "FTT/USD";
  const ftxUtil = getFtxUtil({ subaccount, market });

  await runFtxBot({
    subaccount,
    market,
    strat: tripleEmaStrat,
    resolution: "1min",
    candleSeriesLookBack: 60 * 60 * 6, // 6h
    safeZoneMargin: 0.002,
    enter: ftxUtil.enterWithMarketOrder,
    exit: ftxUtil.exitWithMarketOrder,
  });
})();
