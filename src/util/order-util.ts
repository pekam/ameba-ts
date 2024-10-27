import { isArray, isNumber } from "remeda";
import { Candle, CandleSeries, Order } from "../core/types";
import { SizelessOrder } from "../high-level-api";
import { last } from "./util";

/**
 * Returns the expected fill price for the order in optimal world, meaning that
 * there's no spread, no slippage and the last known price is also the next
 * bid/ask price.
 */
export function getExpectedFillPriceWithoutSlippage(
  order: Order | SizelessOrder,
  currentPriceSource: number | Candle | CandleSeries
): number {
  const currentPrice = isNumber(currentPriceSource)
    ? currentPriceSource
    : isArray(currentPriceSource)
    ? last(currentPriceSource).close
    : currentPriceSource.close;

  // Need to check market order here also for TS to know that it's definitely
  // limit or stop order in the else-block.
  if (order.type === "market" || shouldFillImmediately(order, currentPrice)) {
    return currentPrice;
  } else {
    return order.price;
  }
}

/**
 * Returns true if the order is expected to be filled right away based on the
 * last known price, i.e. if it's a marker order, or the price is past the
 * stop/limit price.
 */
export function shouldFillImmediately(
  order: Order | SizelessOrder,
  currentPrice: number
): boolean {
  if (order.type === "market") {
    return true;
  }
  const { type, price: orderPrice, side } = order;
  if (side === "buy") {
    if (type === "limit") {
      return currentPrice <= orderPrice;
    } else if (type === "stop") {
      return currentPrice >= orderPrice;
    }
  } else if (side === "sell") {
    if (type === "limit") {
      return currentPrice >= orderPrice;
    } else if (type === "stop") {
      return currentPrice <= orderPrice;
    }
  }
  // TODO why doesn't TS recognize the exhaustiveness above?
  throw Error(
    "Unhandled order side+type combo " + JSON.stringify({ side, type })
  );
}
