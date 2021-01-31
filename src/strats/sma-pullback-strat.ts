import { Order, Strategy, TradeState } from "../core/types";
import { m } from "../functions/functions";

const smaPeriod = 30;
const lookback = 10;

export class SmaPullbackStrategy implements Strategy {
  private smas = [];
  init(state: TradeState): void {}

  update(
    state: TradeState
  ): { entryOrder?: Order; stopLoss?: number; takeProfit?: number } {
    const series = state.series;
    const last = m.last(series);

    if (series.length >= smaPeriod) {
      this.smas.push(m.avg(series.slice(-smaPeriod).map((c) => c.close)));
    }

    if (series.length < smaPeriod + lookback) {
      return {};
    }

    const lastSma = m.last(this.smas);

    if (!state.position) {
      const aboveSma =
        series
          .slice(-lookback)
          .filter(
            (c, i) => c.close > this.smas[this.smas.length - lookback + i]
          ).length / lookback;

      if (aboveSma < 0.5) {
        return { entryOrder: null };
      }

      if (last.close > lastSma) {
        return { entryOrder: null };
      }

      const entry = lastSma;
      return {
        entryOrder: {
          price: entry,
          type: "stop",
        },
        stopLoss: m.combine(series.slice(-1)).low,
        takeProfit: entry * 1.03,
      };
    } else {
      return {
        // stopLoss: Math.max(state.stopLoss, m.combine(series.slice(-3)).low),
      };
    }
  }
}
