import { rankAndReport } from "./rank-and-report";
import { Candle, CandleSeries } from "../core/types";
import { m } from "../functions/functions";

const getLowestHighBetween = (c: Candle, c2: Candle, series: CandleSeries) => {
  const between = m.getCandlesBetween(series, c, c2);
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
