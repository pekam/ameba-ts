import { EMA } from "technicalindicators";
import { m } from "../functions/functions";
import { CandleSeries } from "../core/candle-series";
import { FtxBotOrder } from "./market-maker-orders";
import { runFtxBot } from "./bot";

(async function () {
  await runFtxBot({
    strat,
    resolution: "1min",
    candleSeriesLookBack: 60 * 60 * 6, // 6h
    safeZoneMargin: 0.002,
  });
})();

function strat({
  series,
  lastOrder,
}: {
  series: CandleSeries;
  lastOrder: FtxBotOrder;
}) {
  const emaShort = getEma(series, 5);
  const emaLong = getEma(series, 20);
  console.log({
    emaShort,
    emaLong,
  });

  const longCondition = emaShort > emaLong;

  return longCondition;
}

function getEma(series: CandleSeries, period: number) {
  return m.last(
    EMA.calculate({ values: series.slice(-50).map((c) => c.close), period })
  );
}
