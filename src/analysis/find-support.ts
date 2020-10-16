import { CandleSeries } from "../core/candle-series";
import { findLowIndices } from "../strats/series-util";
import { rankAndReport } from "./rank-and-report";

const scoreBySupport = (series: CandleSeries) => {
  const lowIndices = findLowIndices(series);
  if (lowIndices.length < 5) {
    return -9999;
  }
  const lowestLowCandles = lowIndices
    .slice(-5)
    .map((i) => series[i])
    .sort((a, b) => a.low - b.low);

  const lowestLow = lowestLowCandles[0].low;
  const lowDiffScore =
    lowestLowCandles.reduce(
      (acc, current) => acc + Math.abs(current.low - lowestLow),
      0
    ) / lowestLow;

  return 1000 - lowDiffScore;
};

rankAndReport("makkara", scoreBySupport);
