import { CandleSeries } from "../core/candle-series";
import { rankAndReport } from "./rank-and-report";
import { range } from "../util";
import { getAverageCandleSize } from "../strats/series-util";

/**
 */
const scoreByBullishPinBar = (series: CandleSeries) => {
  const scores = range(10).map((i) =>
    scorePinBar(series.slice(0, series.length - i - 10))
  );
  return Math.max(...scores);
};

const scorePinBar = (series: CandleSeries) => {
  const candle = series.last;
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

rankAndReport("makkara", scoreByBullishPinBar, 20);
