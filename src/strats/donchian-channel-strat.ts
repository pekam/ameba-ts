import { Order, Strategy, TradeState } from "../core/types";
import { CandleSeries } from "../core/candle-series";
import { getAverageCandleSize } from "./series-util";
import { SMA } from "technicalindicators";

const channelPeriod = 30;

/**
 * Buy when making new high on the upper Donchian channel.
 *
 * Sell when crossing SMA 20.
 */
export class DonchianChannelStrategy implements Strategy {
  private sma: SMA;

  init(state: TradeState): void {
    this.sma = new SMA({
      period: 20,
      values: state.series
        .slice(0, state.series.length - 1)
        .map((c) => c.close),
    });
  }

  update(
    state: TradeState
  ): { entryOrder?: Order; stopLoss?: number; takeProfit?: number } {
    const series = state.series;

    const sma = this.sma.nextValue(state.series.last.close);

    if (series.length < channelPeriod) {
      return {};
    }

    const { upper } = getDonchianChannel(series, channelPeriod);

    if (!state.position) {
      return {
        entryOrder: {
          price: upper + getAverageCandleSize(series, channelPeriod) / 5,
          type: "stop",
        },
        stopLoss: sma,
      };
    } else {
      return { stopLoss: sma };
    }
  }
}

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
