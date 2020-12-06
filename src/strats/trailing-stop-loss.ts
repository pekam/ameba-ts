import { StrategyUpdate } from "../core/types";
import { last } from "../util";

export const trailingStopLoss: StrategyUpdate = (state) => {
  return {
    stopLoss: Math.max(state.stopLoss, last(state.series).high * 0.95),
  };
};
