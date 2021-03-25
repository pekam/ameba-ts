import { m } from "../functions/functions";
import { rankAndReport } from "./rank-and-report";
import { CandleSeries } from "../core/types";

const scoreByBullishPinBar = (series: CandleSeries) => {
  const candle = m.last(series);
  const height = candle.high - candle.low;
  const limit = candle.low + 0.8 * height;
  if (candle.open < limit || candle.close < limit) {
    return -1;
  }
  if (candle.close < candle.open) {
    return -1;
  }

  return height / m.getAverageCandleSize(series, 30);
};

rankAndReport("makkara", scoreByBullishPinBar, 20, 80);
