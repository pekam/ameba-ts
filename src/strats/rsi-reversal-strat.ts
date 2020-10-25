import { Order, Strategy, TradeState } from "../core/types";
import { Indicators } from "../core/indicators";
import { getAverageCandleSize } from "./series-util";

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
            price: series.last.low,
            type: "limit",
          },
          stopLoss: series.last.low - getAverageCandleSize(series, 5) / 2,
        };
      } else {
        return {
          entryOrder: null,
        };
      }
    } else {
      if (rsi > 70) {
        return { takeProfit: series.last.high, stopLoss: series.last.low };
      }
    }
  }
}
