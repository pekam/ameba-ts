import { SingleAssetStrategyUpdate } from "../core/types";

export const cancelOrders: SingleAssetStrategyUpdate = {
  entryOrder: null,
  stopLoss: null,
  takeProfit: null,
} as const;
