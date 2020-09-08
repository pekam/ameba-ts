import { StrategyUpdate } from "../core/types";

export const trailingStopLoss: StrategyUpdate = (state) => {
  return {
    stopLoss: Math.max(state.stopLoss, state.series.last.high * 0.95),
  };
};
