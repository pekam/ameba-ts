import { Strategy } from "../core/types";

export const trailingStopLoss: Strategy = (state) => {
  return {
    stopLoss: Math.max(state.stopLoss, state.series.last.high * 0.95),
  };
};
