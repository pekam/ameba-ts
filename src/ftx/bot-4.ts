import { donchianBreakoutStrategy } from "../strats/donchian-breakout-strat";
import { botB } from "./bot-b";
import { FtxMarket, getFtxClient } from "./ftx";
import { getFtxUtil } from "./ftx-util";

(async function () {
  const subaccount = "bot-4";
  const market: FtxMarket = "SOL/USD";

  const ftxUtil = getFtxUtil({
    ftx: getFtxClient({ subaccount }),
    market,
  });

  await botB.run({
    ftxUtil,
    resolution: "5min",
    strat: donchianBreakoutStrategy({
      channelPeriod: 50,
      smaPeriod: 50,
      maxRelativeStopLoss: 0.02,
      onlyDirection: "long",
    }),
  });
})();
