import { runFtxBot } from "./bot";
import { tripleEmaStrat } from "./strats";

(async function () {
  await runFtxBot({
    subaccount: "bot-3",
    market: "FTT/USD",
    strat: tripleEmaStrat,
    resolution: "1min",
    candleSeriesLookBack: 60 * 60 * 6, // 6h
    safeZoneMargin: 0.002,
  });
})();
