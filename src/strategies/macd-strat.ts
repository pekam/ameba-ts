import { getMacd, MacdSettings } from "..";
import { AssetState } from "../core/types";
import {
  SizelessOrder,
  StrategyUpdate,
  TradingStrategy,
} from "../high-level-api/types";
import { last } from "../util/util";
import { withRelativeExits } from "./strat-util";

const macdSettings: MacdSettings = {
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
};

export function macdStrat(settings: {
  relativeTakeProfit: number;
  relativeStopLoss: number;
  onlyDirection?: "long" | "short";
}): TradingStrategy {
  return function (state: AssetState): StrategyUpdate {
    const series = state.series;
    const candle = last(series);

    const macd = getMacd(state, macdSettings);
    const previousMacd = getMacd(state, macdSettings, 1);

    if (!macd || !previousMacd) {
      return {};
    }

    if (state.position) {
      return {};
    }

    // All must be true to go long, all must be false to go short
    const bullishFilters = [
      macd.macd > 0,
      previousMacd.histogram < 0,
      previousMacd.histogram < macd.histogram,
    ];

    if (settings.onlyDirection !== "short" && bullishFilters.every((b) => b)) {
      // Long
      const entryPrice = candle.high;
      const entryOrder: SizelessOrder = {
        side: "buy",
        type: "stop",
        price: entryPrice,
      };
      return withRelativeExits({ entryOrder, ...settings });
    }
    if (settings.onlyDirection !== "long" && bullishFilters.every((b) => !b)) {
      // Short
      const entryPrice = candle.low;
      const entryOrder: SizelessOrder = {
        side: "sell",
        type: "stop",
        price: entryPrice,
      };
      return withRelativeExits({ entryOrder, ...settings });
    }
    return { entryOrder: null };
  };
}
