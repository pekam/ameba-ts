import { Order, StrategyUpdate } from "../core/types";

export const cancelEntry: StrategyUpdate = {
  entryOrder: null,
} as const;

export function withRelativeExits({
  entryOrder,
  relativeTakeProfit,
  relativeStopLoss,
}: {
  entryOrder: Order;
  relativeTakeProfit: number;
  relativeStopLoss: number;
}): { entryOrder: Order; takeProfit: number; stopLoss: number } {
  if (entryOrder.side === "buy") {
    return {
      entryOrder,
      takeProfit: entryOrder.price * (1 + relativeTakeProfit),
      stopLoss: entryOrder.price * (1 - relativeStopLoss),
    };
  } else {
    return {
      entryOrder,
      takeProfit: entryOrder.price * (1 - relativeTakeProfit),
      stopLoss: entryOrder.price * (1 + relativeStopLoss),
    };
  }
}
