import { Indicators } from "../core/indicators";
import { Order, Strategy, StrategyUpdate, TradeState } from "../core/types";
import { m } from "../shared/functions";

const rsiPeriod = 10;
const adxPeriod = 20;

/**
 * If ADX is low (there is a sideways trend), buy when RSI is low.
 */
export class RsiReversalStrategy implements Strategy {
  private indicators: Indicators;

  init(state: TradeState): void {
    this.indicators = new Indicators({ rsiPeriod, adxPeriod }, state.series);
  }

  update(state: TradeState): StrategyUpdate {
    const series = state.series;

    const { rsi, adx } = this.indicators.update(series) as {
      rsi: number;
      adx: number;
    };

    if (series.length < Math.max(adxPeriod, rsiPeriod)) {
      return {};
    }

    if (!state.position) {
      if (adx < 25 && rsi < 30) {
        const entryOrder: Order = {
          price: m.last(series).low,
          type: "limit",
          side: "buy",
        };
        return {
          entryOrder,
          stopLoss: m.last(series).low - m.getAverageCandleSize(series, 5) / 2,
        };
      } else {
        return {
          entryOrder: null,
        };
      }
    } else {
      if (rsi > 70) {
        return {
          takeProfit: m.last(series).high,
          stopLoss: m.last(series).low,
        };
      }
    }
    return {};
  }
}
