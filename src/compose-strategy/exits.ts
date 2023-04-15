import {
  AssetPredicate,
  Exit,
  STRATEGY_NOT_READY,
  getAtr,
  newYorkTimeAfterOrEqual,
} from "..";
import { getExpectedFillPriceWithoutSlippage, last } from "../util/util";

/**
 * Sets a take profit a multiple of the ATR indicator away from the entry price.
 */
export function atrTakeProfit(period: number, multiplier: number): Exit {
  return (state, entryOrder) => {
    if (state.position || !entryOrder) {
      return {};
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
      return { takeProfit: entryPrice + profit };
    } else if (entryOrder.side === "sell") {
      return { takeProfit: entryPrice - profit };
    } else {
      const exhaustiveCheck: never = entryOrder.side;
      return {};
    }
  };
}

/**
 * Sets a stop loss a multiple of the ATR indicator away from the entry price.
 */
export function atrStopLoss(period: number, multiplier: number): Exit {
  return (state, entryOrder) => {
    if (state.position || !entryOrder) {
      return {};
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
      return { stopLoss: entryPrice - risk };
    } else if (entryOrder.side === "sell") {
      return { stopLoss: entryPrice + risk };
    } else {
      const exhaustiveCheck: never = entryOrder.side;
      return {};
    }
  };
}

/**
 * Exits when the time reaches the given hour and minute in New York's timezone.
 */
export function newYorkTimeExit(hour: number, minute?: number): Exit {
  return conditionExit(newYorkTimeAfterOrEqual(hour, minute));
}

/**
 * Exits the position when the given condition is fulfilled.
 *
 * Note that since the library doesn't support exiting with a market order, this
 * is implemented by trying to set the stop loss far beyond the current price,
 * or near zero for short positions.
 */
export function conditionExit(entryFilter: AssetPredicate): Exit {
  return (state) => {
    if (entryFilter(state)) {
      if (!state.position) {
        console.warn(
          "Exit condition was true already when setting an entry order. Please fix your strategy."
        );
        return {};
      }
      const candle = last(state.series);
      return {
        stopLoss: state.position.side === "long" ? candle.high * 2 : 0.0001,
      };
    }
    return {};
  };
}
