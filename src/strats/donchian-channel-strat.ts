import { Order, Strategy, TradeState } from "../core/types";
import { Indicators } from "../core/indicators";
import { m } from "../functions/functions";

const channelPeriod = 30;

/**
 * Buy when making new high on the upper Donchian channel.
 *
 * Sell when crossing SMA 20.
 */
export class DonchianChannelStrategy implements Strategy {
  private indicators: Indicators;

  init(state: TradeState): void {
    this.indicators = new Indicators(
      { smaPeriod: 20, donchianChannelPeriod: channelPeriod },
      state.series
    );
  }

  update(
    state: TradeState
  ): { entryOrder?: Order; stopLoss?: number; takeProfit?: number } {
    const series = state.series;

    const { sma, donchianChannel } = this.indicators.update(series);

    if (series.length < channelPeriod) {
      return {};
    }

    if (!state.position) {
      return {
        entryOrder: {
          price:
            donchianChannel.upper +
            m.getAverageCandleSize(series, channelPeriod) / 5,
          type: "stop",
        },
        stopLoss: sma,
      };
    } else {
      return { stopLoss: sma };
    }
  }
}
