import { CandleSeries } from "../core/candle-series";
import { getSwingLows } from "../strats/series-util";
import { rankAndReport } from "./rank-and-report";

const scoreBySupport = (series: CandleSeries) => {
  const swingLows = getSwingLows(series);
  if (swingLows.length < 5) {
    return -9999;
  }
  const lowestLowCandles = swingLows.slice(-5).sort((a, b) => a.low - b.low);

  const lowestLow = lowestLowCandles[0].low;
  const lowDiffScore =
    lowestLowCandles.reduce(
      (acc, current) => acc + Math.abs(current.low - lowestLow),
      0
    ) / lowestLow;

  return 1000 - lowDiffScore;
};

rankAndReport("makkara", scoreBySupport);
