import { Candle, CandleSeries } from "../core/types";
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

  isPinBar: function (args: {
    candle: Candle;
    minSize: number;
    closeLimit?: number;
  }) {
    const { candle, minSize, closeLimit } = {
      closeLimit: 0.8,
      ...args,
    };
    const size = candle.high - candle.close;
    const limit = candle.low + closeLimit * size;
    return size >= minSize && candle.close >= limit && candle.open >= limit;
  },
};
