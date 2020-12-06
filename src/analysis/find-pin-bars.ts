import { CandleSeries } from "../core/candle-series";
import { getAverageCandleSize } from "../strats/series-util";
import { rankAndReport } from "./rank-and-report";
import { last } from "../util";

const scoreByBullishPinBar = (series: CandleSeries) => {
  const candle = last(series);
  const height = candle.high - candle.low;
  const limit = candle.low + 0.8 * height;
  if (candle.open < limit || candle.close < limit) {
    return -1;
  }
  if (candle.close < candle.open) {
    return -1;
  }

  return height / getAverageCandleSize(series, 30);
};

rankAndReport("makkara", scoreByBullishPinBar, 20, 80);
