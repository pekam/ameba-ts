import { OrderSide, OrderType } from "../core/types";
import { Entry, STRATEGY_NOT_READY, ValueProvider } from "./types";

/**
 * Sets a market buy order to enter a long position.
 */
export const marketBuyEntry: Entry = () => ({
  type: "market",
  side: "buy",
});

/**
 * Sets a market sell order to enter a short position.
 */
export const marketSellEntry: Entry = () => ({
  type: "market",
  side: "sell",
});

const pricedEntry =
  (type: Exclude<OrderType, "market">, side: OrderSide) =>
  (orderPriceProvider: ValueProvider): Entry =>
  (state) => {
    const price = orderPriceProvider(state);
    if (price === undefined) {
      return STRATEGY_NOT_READY;
    }
    return {
      type,
      side,
      price,
    };
  };

/**
 * An entry strategy that sets a limit buy order at a price provided by the
 * given value provider.
 */
export const limitBuyEntry = pricedEntry("limit", "buy");
/**
 * An entry strategy that sets a limit sell order at a price provided by the
 * given value provider.
 */
export const limitSellEntry = pricedEntry("limit", "sell");
/**
 * An entry strategy that sets a stop buy order at a price provided by the
 * given value provider.
 */
export const stopBuyEntry = pricedEntry("stop", "buy");
/**
 * An entry strategy that sets a stop sell order at a price provided by the
 * given value provider.
 */
export const stopSellEntry = pricedEntry("stop", "sell");

/**
 * Sets a stop buy order to enter a long position when the price breaks above
 * last N candles.
 */
export const breakoutBuyEntry = (period: number): Entry =>
  stopBuyEntry(({ series }) => {
    if (series.length < period) {
      return undefined;
    }
    return Math.max(...series.slice(-period).map((c) => c.high));
  });
/**
 * Sets a stop sell order to enter a short position when the price breaks below
 * last N candles.
 */
export const breakoutSellEntry = (period: number): Entry =>
  stopSellEntry(({ series }) => {
    if (series.length < period) {
      return undefined;
    }
    return Math.min(...series.slice(-period).map((c) => c.low));
  });
