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
      const longEntry: StrategyUpdate = {
        entryOrder: {
          price:
            donchianChannel.upper +
            m.getAverageCandleSize(series, this.channelPeriod) / 5,
          type: "stop",
          side: "buy",
        },
        stopLoss: sma,
      };

      const shortEntry: StrategyUpdate = {
        entryOrder: {
          price:
            donchianChannel.lower -
            m.getAverageCandleSize(series, this.channelPeriod) / 5,
          type: "stop",
          side: "sell",
        },
        stopLoss: sma,
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
      return { stopLoss: sma };
    }
  }
}
