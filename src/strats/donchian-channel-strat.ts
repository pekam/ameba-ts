import { Strategy } from "../core/types";
import { CandleSeries } from "../core/candle-series";
import { getAverageCandleSize } from "./series-util";

const channelPeriod = 30;

/**
 * Buy when making new high on the upper Donchian channel.
 *
 * Sell when crossing the middle Donchian channel.
 */
export const donchianChannelStrategy: Strategy = (state) => {
  const series = state.series;

  if (series.length < channelPeriod) {
    return;
  }

  const { middle, upper } = getDonchianChannel(series, channelPeriod);

  if (!state.position) {
    return {
      entryOrder: {
        price: upper + getAverageCandleSize(series, channelPeriod) / 5,
        type: "stop",
      },
      stopLoss: middle,
    };
  } else {
    return { stopLoss: middle };
  }
};

function getDonchianChannel(
  series: CandleSeries,
  period: number
): { upper: number; middle: number; lower: number } {
  const subseries = series.slice(-period);
  const upper = Math.max(...subseries.map((candle) => candle.high));
  const lower = Math.min(...subseries.map((candle) => candle.low));
  const middle = lower + (upper - lower) / 2;
  return { upper, lower, middle };
}
