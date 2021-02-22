import { CandleSeries } from "../core/candle-series";
import { FtxBotOrder } from "./market-maker-orders";
import { m } from "../functions/functions";
import { EMA } from "technicalindicators";

export function emaStrat({
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
