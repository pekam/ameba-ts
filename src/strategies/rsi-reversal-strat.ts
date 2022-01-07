import { getAdx, getRsi } from "..";
import { AssetState } from "../core/types";
import { SizelessOrder, StrategyUpdate } from "../high-level-api/types";
import { getAverageCandleSize, last } from "../util/util";
import { cancelEntry } from "./strat-util";

const rsiPeriod = 10;
const adxPeriod = 20;

/**
 * If ADX is low (there is a sideways trend), buy when RSI is low.
 */
export function rsiReversalStrategy() {
  return function (state: AssetState): StrategyUpdate {
    const series = state.series;

    const rsi = getRsi(state, rsiPeriod);
    const adx = getAdx(state, adxPeriod);

    if (!rsi || !adx) {
      return {};
    }

    if (!state.position) {
      if (adx.adx < 25 && rsi < 30) {
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
