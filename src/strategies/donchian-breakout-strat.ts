import { AssetState } from "../core/types";
import { StrategyUpdate, TradingStrategy } from "../high-level-api/types";
import { getAtr } from "../indicators/atr";
import { getDonchianChannel } from "../indicators/donchian-channel";
import { getSma } from "../indicators/sma";
import { last } from "../util/util";

/**
 * Buy when breaking the Donchian channel.
 *
 * Sell when crossing SMA.
 */
export function donchianBreakoutStrategy(settings: {
  channelPeriod: number;
  smaPeriod: number;
  onlyDirection?: "long" | "short";
  maxRelativeStopLoss?: number;
  maxAtrStoploss?: number;
}): TradingStrategy {
  return (state: AssetState) => {
    const currentPrice = last(state.series).close;

    const donchianChannel = getDonchianChannel(state, settings.channelPeriod);
    const sma = getSma(state, settings.smaPeriod);
    const atr = getAtr(state, 20);

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
      if (state.position.side === "long") {
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
