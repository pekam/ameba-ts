import {
  AssetState,
  CandleSeries,
  SingleAssetStrategyUpdate,
} from "../core/types";
import { SizelessOrder } from "../high-level-api/types";
import { getExpectedFillPriceWithoutSlippage, last } from "../util/util";

export const cancelEntry: SingleAssetStrategyUpdate = {
  entryOrder: null,
} as const;

export function withRelativeExits({
  entryOrder,
  series,
  relativeTakeProfit,
  relativeStopLoss,
}: {
  entryOrder: SizelessOrder;
  series: CandleSeries;
  relativeTakeProfit: number;
  relativeStopLoss: number;
}): { entryOrder: SizelessOrder; takeProfit: number; stopLoss: number } {
  const expectedFillPrice = getExpectedFillPriceWithoutSlippage(
    entryOrder,
    series
  );

  if (entryOrder.side === "buy") {
    return {
      entryOrder,
      takeProfit: expectedFillPrice * (1 + relativeTakeProfit),
      stopLoss: expectedFillPrice * (1 - relativeStopLoss),
    };
  } else {
    return {
      entryOrder,
      takeProfit: expectedFillPrice * (1 - relativeTakeProfit),
      stopLoss: expectedFillPrice * (1 + relativeStopLoss),
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
      return state.position.side === "long"
        ? currentPrice - stopLossValue
        : currentPrice + stopLossValue;
    }
    throw Error("Unhandled stop loss type.");
  })();

  const limiterFunc = state.position.side === "long" ? Math.max : Math.min;

  return {
    stopLoss: state.stopLoss
      ? limiterFunc(state.stopLoss, potentialStopLoss)
      : potentialStopLoss,
  };
}
