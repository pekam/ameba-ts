import { SizelessOrder } from "../core/staker";
import { AssetState, SingleAssetStrategyUpdate } from "../core/types";
import { last } from "../util/util";

export const cancelEntry: SingleAssetStrategyUpdate = {
  entryOrder: null,
} as const;

export function withRelativeExits<O extends SizelessOrder>({
  entryOrder,
  relativeTakeProfit,
  relativeStopLoss,
}: {
  entryOrder: O;
  relativeTakeProfit: number;
  relativeStopLoss: number;
}): { entryOrder: O; takeProfit: number; stopLoss: number } {
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
  state: AssetState;
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
      const currentPrice = last(state.series).close;
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
