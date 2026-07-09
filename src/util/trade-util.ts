import { Trade } from "../core/types";

export function getInitialRisk(trade: Trade): number | null {
  if (trade.initialStopLoss === null || trade.initialStopLoss === undefined) {
    return null;
  }

  return (
    Math.abs(trade.entry.price - trade.initialStopLoss) * trade.position.size
  );
}
