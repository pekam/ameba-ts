import { CandleSeries } from "../core/candle-series";
import { m } from "./functions";

export const candlePatterns = {
  isInsideBar: function (series: CandleSeries) {
    if (series.length < 2) {
      throw new Error(
        "Array too short. 2 candles needed to check inside bar pattern."
      );
    }
    const lastCandle = m.last(series);
    const prevCandle = m.get(series, -2);
    return lastCandle.high < prevCandle.high && lastCandle.low > prevCandle.low;
  },
};
