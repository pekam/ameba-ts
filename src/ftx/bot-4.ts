import { donchianBreakoutStrategy } from "../strats/donchian-breakout-strat";
import { botB } from "./bot-b";
import { FtxMarket, getFtxClient } from "./ftx";
import { getFtxUtil } from "./ftx-util";

(async function () {
  const subaccount = "bot-4";
  const market: FtxMarket = "FTT/USD";

  const ftxUtil = getFtxUtil({
    ftx: getFtxClient({ subaccount }),
    market,
  });

  await botB.run({
    ftxUtil,
    resolution: "1min",
    strat: donchianBreakoutStrategy({
      channelPeriod: 100,
      smaPeriod: 100,
      onlyDirection: "long",
      maxRelativeStopLoss: 0.02,
    }),
  });
})();
