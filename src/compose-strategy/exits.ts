import { getAtr } from "..";
import { getExpectedFillPriceWithoutSlippage } from "../util/util";
import { Exit, STRATEGY_NOT_READY } from "./compose-strategy";

/**
 * Sets a take profit a multiple of the ATR indicator away from the entry price.
 */
export function atrTakeProfit(period: number, multiplier: number): Exit {
  return (state, entryOrder) => {
    if (state.position || !entryOrder) {
      return state.takeProfit;
    }
    const atr = getAtr(state, period);
    if (!atr) {
      return STRATEGY_NOT_READY;
    }
    const entryPrice = getExpectedFillPriceWithoutSlippage(
      entryOrder,
      state.series
    );
    const profit = atr * multiplier;
    if (entryOrder.side === "buy") {
      return entryPrice + profit;
    } else if (entryOrder.side === "sell") {
      return entryPrice - profit;
    } else {
      const exhaustiveCheck: never = entryOrder.side;
    }
  };
}

/**
 * Sets a stop loss a multiple of the ATR indicator away from the entry price.
 */
export function atrStopLoss(period: number, multiplier: number): Exit {
  return (state, entryOrder) => {
    if (state.position || !entryOrder) {
      return state.stopLoss;
    }
    const atr = getAtr(state, period);
    if (!atr) {
      return STRATEGY_NOT_READY;
    }
    const entryPrice = getExpectedFillPriceWithoutSlippage(
      entryOrder,
      state.series
    );
    const risk = atr * multiplier;
    if (entryOrder.side === "buy") {
      return entryPrice - risk;
    } else if (entryOrder.side === "sell") {
      return entryPrice + risk;
    } else {
      const exhaustiveCheck: never = entryOrder.side;
    }
  };
}
