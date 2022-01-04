import { AssetState } from "../core/types";
import { StrategyUpdate, TradingStrategy } from "../high-level-api/types";
import { Indicators } from "../indicators/indicators";
import { last } from "../util/util";

function withSma(strategy: TradingStrategy, period: number): TradingStrategy {
  return (state: AssetState) => {
    const indicators =
      state.data.indicators || new Indicators({ smaPeriod: period });

    const { sma } = indicators.update(state.series);

    const data = { ...state.data, indicators, sma };

    const stratUpdate = strategy({ ...state, data });

    return { ...stratUpdate, data };
  };
}

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
  const indicators = new Indicators({
    donchianChannelPeriod: settings.channelPeriod,
    // smaPeriod: settings.smaPeriod,
    atrPeriod: 20,
  });

  const rawStrat = (state: AssetState) => {
    const series = state.series;
    const currentPrice = last(state.series).close;

    const { donchianChannel, atr } = indicators.update(series);

    // How to make typings work?
    const sma: number = state.data.sma;

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

  return withSma(rawStrat, settings.smaPeriod);
}
