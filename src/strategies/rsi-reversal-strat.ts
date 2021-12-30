import { Indicators } from "../indicators/indicators";
import { SizelessOrder, StrategyUpdate } from "../core/staker";
import { AssetState } from "../core/types";
import { getAverageCandleSize, last } from "../util/util";
import { cancelEntry } from "./strat-util";

const rsiPeriod = 10;
const adxPeriod = 20;

/**
 * If ADX is low (there is a sideways trend), buy when RSI is low.
 */
export function rsiReversalStrategy() {
  const indicators = new Indicators({ rsiPeriod, adxPeriod });

  return function (state: AssetState): StrategyUpdate {
    const series = state.series;

    const { rsi, adx } = indicators.update(series) as {
      rsi: number;
      adx: number;
    };

    if (series.length < Math.max(adxPeriod, rsiPeriod)) {
      return {};
    }

    if (!state.position) {
      if (adx < 25 && rsi < 30) {
        const entryPrice = last(series).low;
        const entryOrder: SizelessOrder = {
          price: entryPrice,
          type: "limit",
          side: "buy",
        };
        return {
          entryOrder,
          stopLoss: last(series).low - getAverageCandleSize(series, 5) / 2,
        };
      } else {
        return cancelEntry;
      }
    } else {
      if (rsi > 70) {
        return {
          takeProfit: last(series).high,
          stopLoss: last(series).low,
        };
      }
    }
    return {};
  };
}