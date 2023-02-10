import { Entry, STRATEGY_NOT_READY } from "./compose-strategy";

/**
 * Sets a market buy order to enter a long position.
 */
export const marketBuy: Entry = () => ({
  type: "market",
  side: "buy",
});

/**
 * Sets a market sell order to enter a short position.
 */
export const marketSell: Entry = () => ({
  type: "market",
  side: "sell",
});

/**
 * Sets a stop buy order to enter a long position when the price breaks above
 * last N candles.
 */
export const breakoutBuy =
  (period: number): Entry =>
  ({ series }) => {
    if (series.length < period) {
      return STRATEGY_NOT_READY;
    }
    return {
      side: "buy",
      type: "stop",
      price: Math.max(...series.slice(-period).map((c) => c.high)),
    };
  };

/**
 * Sets a stop sell order to enter a short position when the price breaks below
 * last N candles.
 */
export const breakoutSell =
  (period: number): Entry =>
  ({ series }) => {
    if (series.length < period) {
      return STRATEGY_NOT_READY;
    }
    return {
      side: "sell",
      type: "stop",
      price: Math.min(...series.slice(-period).map((c) => c.low)),
    };
  };
