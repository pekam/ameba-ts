import { Order, Strategy, TradeState } from "../core/types";
import { Indicators } from "../core/indicators";
import { m } from "../functions/functions";

/**
 * Buy when making new high on the upper Donchian channel.
 *
 * Sell when crossing SMA.
 */
export class DonchianBreakoutStrategy implements Strategy {
  private indicators: Indicators;

  constructor(private channelPeriod: number, private smaPeriod: number) {}

  init(state: TradeState): void {
    this.indicators = new Indicators(
      { donchianChannelPeriod: this.channelPeriod, smaPeriod: this.smaPeriod },
      state.series
    );
  }

  update(
    state: TradeState
  ): { entryOrder?: Order; stopLoss?: number; takeProfit?: number } {
    const series = state.series;

    const { sma, donchianChannel } = this.indicators.update(series);

    if (series.length < this.channelPeriod || !donchianChannel) {
      return {};
    }

    if (!state.position) {
      return {
        entryOrder: {
          price:
            donchianChannel.upper +
            m.getAverageCandleSize(series, this.channelPeriod) / 5,
          type: "stop",
          side: "buy",
        },
        stopLoss: sma,
      };
    } else {
      return { stopLoss: sma };
    }
  }
}
