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
export function donchianBreakoutStrategy(settings: {
  channelPeriod: number;
  smaPeriod: number;
  onlyDirection?: MarketPosition;
  maxRelativeStopLoss?: number;
}): Strategy {
  const indicators = new Indicators({
    donchianChannelPeriod: settings.channelPeriod,
    smaPeriod: settings.smaPeriod,
  });

  return (state: TradeState) => {
    const series = state.series;
    const currentPrice = m.last(state.series).close;

    const { sma, donchianChannel } = indicators.update(series);

    if (series.length < settings.channelPeriod || !donchianChannel || !sma) {
      return {};
    }

    if (!state.position) {
      const avgRange = m.getAverageCandleSize(series, 20);

      const longEntry: () => StrategyUpdate = () => {
        const entryPrice = donchianChannel.upper + avgRange / 5;
        const stopLosses = [sma, entryPrice - avgRange];
        if (settings.maxRelativeStopLoss) {
          stopLosses.push(entryPrice * (1 - settings.maxRelativeStopLoss));
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
        if (settings.maxRelativeStopLoss) {
          stopLosses.push(entryPrice * (1 + settings.maxRelativeStopLoss));
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

      if (settings.onlyDirection === "long") {
        return longEntry();
      } else if (settings.onlyDirection === "short") {
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
        return {
          stopLoss: state.stopLoss ? Math.max(state.stopLoss, sma) : sma,
        };
      } else {
        return {
          stopLoss: state.stopLoss ? Math.min(state.stopLoss, sma) : sma,
        };
      }
    }
  };
}
