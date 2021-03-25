import { rankAndReport } from "./rank-and-report";
import { CandleSeries } from "../core/types";

/**
 * Scores the candle series by the number of consecutive candles
 * that are above the simple moving average, taken from the end
 * of the series.
 */
const scoreByLongTrend = (series: CandleSeries) => {
  const smaPeriod = 20;

  let index = series.length - 1;
  let counter = 0;
  while (index > smaPeriod) {
    const sma =
      series
        .slice(index - smaPeriod, index)
        .map((c) => c.close)
        .reduce((a, b) => a + b) / smaPeriod;
    if (series[index].low < sma) {
      break;
    }
    counter++;
    index--;
  }

  return counter;
};

rankAndReport("makkara", scoreByLongTrend);
