import { FtxMarket, getFtxClient } from "./ftx";
import { runFtxBot } from "./bot";
import { getFtxMarketMaker } from "./market-maker-orders";
import { getEmaStrat } from "./strats";
import { getFtxUtil } from "./ftx-util";
import { getFtxMarketOrders } from "./market-orders";

(async function () {
  const subaccount = "bot-4";
  const market: FtxMarket = "SUSHI/USD";
  const { enter, exit } = getFtxMarketMaker({ subaccount, market });
  const util = getFtxUtil({ ftx: getFtxClient({ subaccount }), market });

  const marketOrders = getFtxMarketOrders(util);

  await runFtxBot({
    subaccount,
    market,
    strat: getEmaStrat(2, 5),
    resolution: "1min",
    candleSeriesLookBack: 60 * 60 * 6, // 6h
    safeZoneMargin: 0.002,
    enter: marketOrders.enterWithMarketOrder,
    exit: marketOrders.exitWithMarketOrder,
    loopMs: 60 * 1000,
  });
})();
