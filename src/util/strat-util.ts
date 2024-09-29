import { SingleAssetStrategyUpdate } from "../core/types";

export const CANCEL_ORDERS_UPDATE: SingleAssetStrategyUpdate = {
  entryOrder: null,
  stopLoss: null,
  takeProfit: null,
} as const;
