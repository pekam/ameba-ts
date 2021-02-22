import { runFtxBot } from "./bot";
import { emaStrat } from "./strats";

(async function () {
  await runFtxBot({
    subaccount: "bot",
    market: "BTC/USD",
    strat: emaStrat,
    resolution: "1min",
    candleSeriesLookBack: 60 * 60 * 6, // 6h
    safeZoneMargin: 0.002,
  });
})();
