import { Indicators } from "../indicators/indicators";
import { StrategyUpdate, TradingStrategy } from "../core/staker";
import { AssetState, MarketPosition } from "../core/types";
import { last } from "../shared/functions";

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
  maxAtrStoploss?: number;
}): TradingStrategy {
  const indicators = new Indicators({
    donchianChannelPeriod: settings.channelPeriod,
    smaPeriod: settings.smaPeriod,
    atrPeriod: 20,
  });

  return (state: AssetState) => {
    const series = state.series;
    const currentPrice = last(state.series).close;

    const { sma, donchianChannel, atr } = indicators.update(series);

    if (!donchianChannel || !sma || !atr) {
      return {};
    }

    if (!state.position) {
      const longEntry: () => StrategyUpdate = () => {
        const entryPrice = donchianChannel.upper + atr / 5;
        const stopLosses = [sma];
        if (settings.maxRelativeStopLoss) {
          stopLosses.push(entryPrice * (1 - settings.maxRelativeStopLoss));
        }
        if (settings.maxAtrStoploss) {
          stopLosses.push(entryPrice - atr * settings.maxAtrStoploss);
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
        const entryPrice = donchianChannel.lower - atr / 5;
        const stopLosses = [sma];
        if (settings.maxRelativeStopLoss) {
          stopLosses.push(entryPrice * (1 + settings.maxRelativeStopLoss));
        }
        if (settings.maxAtrStoploss) {
          stopLosses.push(entryPrice + atr * settings.maxAtrStoploss);
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
