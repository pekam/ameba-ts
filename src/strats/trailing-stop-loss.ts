import { StrategyUpdate, TradeState } from "../core/types";
import { m } from "../shared/functions";

export function trailingStopLoss(state: TradeState): StrategyUpdate {
  return {
    stopLoss: Math.max(state.stopLoss || 0, m.last(state.series).high * 0.95),
  };
}
