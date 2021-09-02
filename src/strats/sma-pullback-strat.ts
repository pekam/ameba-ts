import { Order, StrategyUpdate, TradeState } from "../core/types";
import { m } from "../shared/functions";
import { cancelEntry } from "./strat-util";

const smaPeriod = 30;
const lookback = 10;

export function smaPullbackStrategy() {
  const smas: number[] = [];

  return function (state: TradeState): StrategyUpdate {
    const series = state.series;
    const last = m.last(series);

    if (series.length >= smaPeriod) {
      smas.push(m.avg(series.slice(-smaPeriod).map((c) => c.close)));
    }

    if (series.length < smaPeriod + lookback) {
      return {};
    }

    const lastSma = m.last(smas);

    if (!state.position) {
      const aboveSma =
        series
          .slice(-lookback)
          .filter((c, i) => c.close > smas[smas.length - lookback + i]).length /
        lookback;

      if (aboveSma < 0.5) {
        return cancelEntry;
      }

      if (last.close > lastSma) {
        return cancelEntry;
      }

      const entryPrice = lastSma;

      const entryOrder: Order = {
        price: entryPrice,
        type: "stop",
        side: "buy",
      };
      return {
        entryOrder,
        stopLoss: m.combine(series.slice(-1)).low,
        takeProfit: entryPrice * 1.03,
      };
    } else {
      return {
        // stopLoss: Math.max(state.stopLoss, m.combine(series.slice(-3)).low),
      };
    }
    return {};
  };
}
