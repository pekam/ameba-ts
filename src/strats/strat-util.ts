import { Order, StrategyUpdate, TradeState } from "../core/types";
import { m } from "../shared/functions";

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

export function nonIncresingStopLoss({
  state,
  stopLossValue,
  stopLossType,
}: {
  state: TradeState;
  stopLossValue: number;
  stopLossType: "absolute" | "diff";
}): { stopLoss: number } {
  if (stopLossValue < 0) {
    throw Error("Stop loss value should be positive.");
  }
  if (!state.position) {
    throw Error("There should already be a position.");
  }

  const potentialStopLoss: number = (function () {
    if (stopLossType === "absolute") {
      return stopLossValue;
    } else if (stopLossType === "diff") {
      const currentPrice = m.last(state.series).close;
      return state.position === "long"
        ? currentPrice - stopLossValue
        : currentPrice + stopLossValue;
    }
    throw Error("Unhandled stop loss type.");
  })();

  const limiterFunc = state.position === "long" ? Math.max : Math.min;

  return {
    stopLoss: state.stopLoss
      ? limiterFunc(state.stopLoss, potentialStopLoss)
      : potentialStopLoss,
  };
}
