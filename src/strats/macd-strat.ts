import { Indicators } from "../core/indicators";
import {
  MarketPosition,
  Order,
  StrategyUpdate,
  TradeState,
} from "../core/types";
import { m } from "../shared/functions";
import { withRelativeExits } from "./strat-util";

export function macdStrat(settings: {
  relativeTakeProfit: number;
  relativeStopLoss: number;
  onlyDirection?: MarketPosition;
}) {
  const indicators = new Indicators({
    macdSettings: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  });

  return function (state: TradeState): StrategyUpdate {
    const series = state.series;
    const candle = m.last(series);

    const { macd } = indicators.update(series);

    const previousMacd = (() => {
      const prevIndicators = indicators.get(m.get(series, -2));
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
      const entryOrder: Order = {
        side: "buy",
        type: "stop",
        price: candle.high,
      };
      return withRelativeExits({ entryOrder, ...settings });
    }
    if (settings.onlyDirection !== "long" && bullishFilters.every((b) => !b)) {
      // Short
      const entryOrder: Order = {
        side: "sell",
        type: "stop",
        price: candle.low,
      };
      return withRelativeExits({ entryOrder, ...settings });
    }
    return { entryOrder: null };
  };
}
