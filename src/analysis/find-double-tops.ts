import { CandleSeries } from "../core/candle-series";
import { rankAndReport } from "./rank-and-report";
import { Candle } from "../core/types";

const getCandlesBetween = (c: Candle, c2: Candle, series: CandleSeries) => {
  const index1 = series.findIndex((cc) => cc.time === c.time);
  const index2 = series.findIndex((cc) => cc.time === c2.time);
  const lowInd = Math.min(index1, index2);
  const highInd = Math.max(index1, index2);
  return series.slice(lowInd + 1, highInd);
};

const getLowestHighBetween = (c: Candle, c2: Candle, series: CandleSeries) => {
  const between = getCandlesBetween(c, c2, series);
  if (!between.length) {
    return null;
  }
  return Math.min(...between.map((c) => c.high));
};

const scoreByDoubleTops = (series: CandleSeries) => {
  const candlesToInclude = series.slice(-30);

  const sorted = candlesToInclude.slice().sort((a, b) => b.high - a.high);

  const highestCandle = sorted[0];
  const high = highestCandle.high;

  const closeToHigh = sorted
    .slice(1)
    .filter((c) => (high - c.high) / high < 0.0005);

  const anotherHigh = closeToHigh.find((c) => {
    const lowestPriceBetween = getLowestHighBetween(
      c,
      highestCandle,
      candlesToInclude
    );

    return lowestPriceBetween && (high - lowestPriceBetween) / high > 0.02;
  });
  if (anotherHigh) {
    return 1;
  }
  return 0;
};

rankAndReport("makkara", scoreByDoubleTops);
