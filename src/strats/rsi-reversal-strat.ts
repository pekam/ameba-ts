import { Order, Strategy, TradeState } from "../core/types";
import { Indicators } from "../core/indicators";
import { last } from "../util";
import { m } from "../functions/functions";

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

  update(
    state: TradeState
  ): { entryOrder?: Order; stopLoss?: number; takeProfit?: number } {
    const series = state.series;

    const { rsi, adx } = this.indicators.update(series);

    if (series.length < Math.max(adxPeriod, rsiPeriod)) {
      return {};
    }

    if (!state.position) {
      if (adx < 25 && rsi < 30) {
        return {
          entryOrder: {
            price: last(series).low,
            type: "limit",
          },
          stopLoss: last(series).low - m.getAverageCandleSize(series, 5) / 2,
        };
      } else {
        return {
          entryOrder: null,
        };
      }
    } else {
      if (rsi > 70) {
        return { takeProfit: last(series).high, stopLoss: last(series).low };
      }
    }
  }
}
