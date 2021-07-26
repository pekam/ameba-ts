import { StrategyUpdate } from "../core/types";
import { m } from "../shared/functions";

export const trailingStopLoss: StrategyUpdate = (state) => {
  return {
    stopLoss: Math.max(state.stopLoss || 0, m.last(state.series).high * 0.95),
  };
};
