import { CandleSeries } from "../core/candle-series";
import { Candle } from "../core/types";
import { avg } from "../util";
import { getSwingHighs, getSwingLows } from "./swing-highs-lows";

/**
 * Collection of utility functions.
 */
export const m = {
  getAverageCandleSize: function (series: CandleSeries, countFromEnd: number) {
    const head: Candle[] =
      series.length >= countFromEnd ? series.slice(-countFromEnd) : series;
    return avg(head.map((candle) => candle.high - candle.low));
  },
  getSwingHighs,
  getSwingLows,
};
