import { Indicators } from "../indicators/indicators";
import { SizelessOrder, StrategyUpdate, TradingStrategy } from "../core/staker";
import { AssetState, MarketPosition } from "../core/types";
import { get, last } from "../shared/functions";
import { withRelativeExits } from "./strat-util";

export function macdStrat(settings: {
  relativeTakeProfit: number;
  relativeStopLoss: number;
  onlyDirection?: MarketPosition;
}): TradingStrategy {
  const indicators = new Indicators({
    macdSettings: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  });

  return function (state: AssetState): StrategyUpdate {
    const series = state.series;
    const candle = last(series);

    const { macd } = indicators.update(series);

    const previousMacd = (() => {
      const prevIndicators = indicators.get(get(series, -2));
      return prevIndicators && prevIndicators.macd;
    })();

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
