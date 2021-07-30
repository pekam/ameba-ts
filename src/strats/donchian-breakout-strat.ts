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
    private settings: {
      channelPeriod: number;
      smaPeriod: number;
      onlyDirection?: MarketPosition;
      maxRelativeStopLoss?: number;
    }
  ) {}

  init(state: TradeState): void {
    this.indicators = new Indicators(
      {
        donchianChannelPeriod: this.settings.channelPeriod,
        smaPeriod: this.settings.smaPeriod,
      },
      state.series
    );
  }

  update(state: TradeState): StrategyUpdate {
    const series = state.series;
    const currentPrice = m.last(state.series).close;

    const { sma, donchianChannel } = this.indicators.update(series);

    if (
      series.length < this.settings.channelPeriod ||
      !donchianChannel ||
      !sma
    ) {
      return {};
    }

    if (!state.position) {
      const avgRange = m.getAverageCandleSize(series, 20);

      const longEntry: () => StrategyUpdate = () => {
        const entryPrice = donchianChannel.upper + avgRange / 5;
        const stopLosses = [sma, entryPrice - avgRange];
        if (this.settings.maxRelativeStopLoss) {
          stopLosses.push(entryPrice * (1 - this.settings.maxRelativeStopLoss));
        }
        return {
          entryOrder: {
            price: entryPrice,
            type: "stop",
            side: "buy",
          },
          stopLoss: Math.max(...stopLosses),
        };
      };

      const shortEntry: () => StrategyUpdate = () => {
        const entryPrice = donchianChannel.lower - avgRange / 5;
        const stopLosses = [sma, entryPrice + avgRange];
        if (this.settings.maxRelativeStopLoss) {
          stopLosses.push(entryPrice * (1 + this.settings.maxRelativeStopLoss));
        }
        return {
          entryOrder: {
            price: entryPrice,
            type: "stop",
            side: "sell",
          },
          stopLoss: Math.min(...stopLosses),
        };
      };

      if (this.settings.onlyDirection === "long") {
        return longEntry();
      } else if (this.settings.onlyDirection === "short") {
        return shortEntry();
      }

      const closerToUpperChannel =
        Math.abs(donchianChannel.upper - currentPrice) <
        Math.abs(currentPrice - donchianChannel.lower);

      if (closerToUpperChannel) {
        return longEntry();
      } else {
        return shortEntry();
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
