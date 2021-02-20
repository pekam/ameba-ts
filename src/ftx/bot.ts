import { ftx } from "./ftx";
import { getCurrentTimestampInSeconds, sleep } from "../util";
import { EMA } from "technicalindicators";
import { m } from "../functions/functions";
import { CandleSeries } from "../core/candle-series";
import { enterAsMarketMaker, exitAsMarketMaker } from "./market-maker-orders";

const market = "BTC/USD";

(async function () {
  while (true) {
    console.log(" ----- " + new Date() + " ----- ");
    const series = await getRecentCandles();
    const ema20 = getEma(series, 20);
    const ema5 = getEma(series, 5);
    console.log({ ema20, ema5 });
    if (ema5 > ema20) {
      await enterAsMarketMaker();
    } else {
      await exitAsMarketMaker();
    }
    console.log("sleeping for 10s");
    await sleep(10 * 1000);
  }
})();

function getEma(series: CandleSeries, period: number) {
  return m.last(
    EMA.calculate({ values: series.slice(-50).map((c) => c.close), period })
  );
}

async function getRecentCandles() {
  return ftx.getCandleSeries({
    market,
    resolution: "1min",
    startTime: getCurrentTimestampInSeconds() - 60 * 60 * 6, // 6h
    endTime: getCurrentTimestampInSeconds(),
  });
}