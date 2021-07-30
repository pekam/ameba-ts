import { Indicators } from "../core/indicators";
import {
  MarketPosition,
  Strategy,
  StrategyUpdate,
  TradeState,
} from "../core/types";
import { m } from "../shared/functions";

/**
 * Buy when breaking the Donchian channel.
 *
 * Sell when crossing SMA.
 */
export class DonchianBreakoutStrategy implements Strategy {
  private indicators: Indicators;

  constructor(
    private channelPeriod: number,
    private smaPeriod: number,
    private onlyDirection?: MarketPosition
  ) {}

  init(state: TradeState): void {
    this.indicators = new Indicators(
      { donchianChannelPeriod: this.channelPeriod, smaPeriod: this.smaPeriod },
      state.series
    );
  }

  update(state: TradeState): StrategyUpdate {
    const series = state.series;
    const currentPrice = m.last(state.series).close;

    const { sma, donchianChannel } = this.indicators.update(series);

    if (series.length < this.channelPeriod || !donchianChannel || !sma) {
      return {};
    }

    if (!state.position) {
      const avgRange = m.getAverageCandleSize(series, 20);

      const longEntry: StrategyUpdate = {
        entryOrder: {
          price: donchianChannel.upper + avgRange / 5,
          type: "stop",
          side: "buy",
        },
        stopLoss: Math.max(sma, donchianChannel.upper - avgRange),
      };

      const shortEntry: StrategyUpdate = {
        entryOrder: {
          price: donchianChannel.lower - avgRange / 5,
          type: "stop",
          side: "sell",
        },
        stopLoss: Math.min(sma, donchianChannel.lower + avgRange),
      };

      if (this.onlyDirection === "long") {
        return longEntry;
      } else if (this.onlyDirection === "short") {
        return shortEntry;
      }

      const closerToUpperChannel =
        Math.abs(donchianChannel.upper - currentPrice) <
        Math.abs(currentPrice - donchianChannel.lower);

      if (closerToUpperChannel) {
        return longEntry;
      } else {
        return shortEntry;
      }
    } else {
      if (state.position === "long") {
        return { stopLoss: Math.max(state.stopLoss!, sma) };
      } else {
        return { stopLoss: Math.min(state.stopLoss!, sma) };
      }
    }
  }
}
