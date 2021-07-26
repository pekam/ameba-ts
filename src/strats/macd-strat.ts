import { Indicators } from "../core/indicators";
import {
  MarketPosition,
  Order,
  Strategy,
  StrategyUpdate,
  TradeState,
} from "../core/types";
import { m } from "../shared/functions";

export class MacdStrat implements Strategy {
  private indicators: Indicators;

  constructor(
    private settings: {
      relativeTakeProfit: number;
      relativeStopLoss: number;
      onlyDirection?: MarketPosition;
    }
  ) {}

  init(state: TradeState): void {
    this.indicators = new Indicators(
      {
        macdSettings: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      },
      state.series
    );
  }
  update: StrategyUpdate = (state) => {
    const series = state.series;
    const candle = m.last(series);

    const { macd } = this.indicators.update(series);

    const previousMacd = (() => {
      const prevIndicators = this.indicators.get(m.get(series, -2));
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

    if (
      this.settings.onlyDirection !== "short" &&
      bullishFilters.every((b) => b)
    ) {
      // Long
      const entryOrder: Order = {
        side: "buy",
        type: "stop",
        price: candle.high,
      };
      const long = {
        entryOrder,
        ...relativeExits({ entryOrder, ...this.settings }),
      };
      return long;
    }
    if (
      this.settings.onlyDirection !== "long" &&
      bullishFilters.every((b) => !b)
    ) {
      // Short
      const entryOrder: Order = {
        side: "sell",
        type: "stop",
        price: candle.low,
      };
      const short = {
        entryOrder,
        ...relativeExits({ entryOrder, ...this.settings }),
      };
      return short;
    }
    return { entryOrder: null };
  };
}

function relativeExits({
  entryOrder,
  relativeTakeProfit,
  relativeStopLoss,
}: {
  entryOrder: Order;
  relativeTakeProfit: number;
  relativeStopLoss: number;
}): { takeProfit: number; stopLoss: number } {
  if (entryOrder.side === "buy") {
    return {
      takeProfit: entryOrder.price * (1 + relativeTakeProfit),
      stopLoss: entryOrder.price * (1 - relativeStopLoss),
    };
  } else {
    return {
      takeProfit: entryOrder.price * (1 - relativeTakeProfit),
      stopLoss: entryOrder.price * (1 + relativeStopLoss),
    };
  }
}
