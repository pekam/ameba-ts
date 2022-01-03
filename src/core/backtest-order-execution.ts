import { dropLast, identity, pipe } from "remeda";
import { last } from "../util/util";
import {
  AssetState,
  Candle,
  CommissionProvider,
  MarketPosition,
  Order,
  Trade,
  Transaction,
} from "./types";

// This module deals with the combination of a single asset's state (position,
// orders, candles, etc.) and the account's cash balance.
interface AssetAndCash {
  asset: AssetState;
  cash: number;
}
interface OrderHandlerState extends AssetAndCash {
  commissionProvider: CommissionProvider;
}

/**
 * Takes the latest candle in the series and executes orders in the state based
 * on those price changes. Returns the updated asset state and cash balance.
 */
export function handleOrders(state: OrderHandlerState): OrderHandlerState {
  if (!state.asset.position) {
    return handleOrdersOnEntryCandle(handleEntryOrder(state));
  } else {
    // Could be executed in an order based on candle direction, instead of
    // always running stop loss first.
    return handleTakeProfit(handleStopLoss(state));
  }
}

// Stop loss and take profit need to be handled differently on the candle where
// entry was triggered.
function handleOrdersOnEntryCandle(
  state: OrderHandlerState
): OrderHandlerState {
  const { position, takeProfit, stopLoss } = state.asset;
  if (!position) {
    // Entry not triggered.
    return state;
  }

  const shouldHandleStopLoss =
    !!stopLoss && shouldHandleOrderOnEntryCandle(state, stopLoss);
  const shouldHandleTakeProfit =
    !!takeProfit && shouldHandleOrderOnEntryCandle(state, takeProfit);

  return pipe(
    state,
    shouldHandleStopLoss ? handleStopLoss : identity,
    shouldHandleTakeProfit ? handleTakeProfit : identity
  );
}

function shouldHandleOrderOnEntryCandle(
  state: OrderHandlerState,
  orderPrice: number
): boolean {
  const candle = last(state.asset.series);
  // If the candle was green, assume that only prices above the entry price are
  // covered after the entry, and vice versa.
  const priceMovedUp: boolean = candle.close > candle.open;
  const entryPrice = last(state.asset.transactions).price;

  return (
    (priceMovedUp && orderPrice > entryPrice) ||
    (!priceMovedUp && orderPrice < entryPrice)
  );
}

function handleEntryOrder(state: OrderHandlerState): OrderHandlerState {
  const { position, entryOrder, series } = state.asset;
  if (!position && entryOrder) {
    const fillPrice = getFillPrice(entryOrder, last(series));
    if (fillPrice) {
      return fulfillEntryOrder(state, entryOrder, fillPrice);
    }
  }
  return state;
}

function handleStopLoss(state: OrderHandlerState): OrderHandlerState {
  const { position, stopLoss, series } = state.asset;
  if (position && stopLoss) {
    const stopLossOrder: Order = {
      price: stopLoss,
      type: "stop",
      side: position.side === "long" ? "sell" : "buy",
      size: position.size,
    };
    const price = getFillPrice(stopLossOrder, last(series));
    if (price) {
      return fulfillExitOrder(state, stopLossOrder, price);
    }
  }
  return state;
}

function handleTakeProfit(state: OrderHandlerState): OrderHandlerState {
  const { position, takeProfit, series } = state.asset;
  if (position && takeProfit) {
    const takeProfitOrder: Order = {
      price: takeProfit,
      type: "limit",
      side: position.side === "long" ? "sell" : "buy",
      size: position.size,
    };
    const fillPrice = getFillPrice(takeProfitOrder, last(series));
    if (fillPrice) {
      return fulfillExitOrder(state, takeProfitOrder, fillPrice);
    }
  }
  return state;
}

/**
 * If the order should become fulfilled with the new candle, returns the price
 * where the transaction took place. Otherwise returns null.
 *
 * The price ignores slippage except that caused by gaps between previous
 * candle's close and current candle's open.
 */
function getFillPrice(order: Order, newCandle: Candle): number | null {
  const priceBelowOrder = newCandle.low <= order.price;
  if (priceBelowOrder) {
    const buyPriceCrossed = order.side === "buy" && order.type === "limit";
    const sellPriceCrossed = order.side === "sell" && order.type === "stop";
    if (buyPriceCrossed || sellPriceCrossed) {
      return Math.min(order.price, newCandle.open);
    }
  }

  const priceAboveOrder = newCandle.high >= order.price;
  if (priceAboveOrder) {
    const buyPriceCrossed = order.side === "buy" && order.type === "stop";
    const sellPriceCrossed = order.side === "sell" && order.type === "limit";
    if (buyPriceCrossed || sellPriceCrossed) {
      return Math.max(order.price, newCandle.open);
    }
  }

  return null;
}

function fulfillEntryOrder(
  state: OrderHandlerState,
  entryOrder: Order,
  fillPrice: number
): OrderHandlerState {
  const transaction = withCommission(
    {
      side: entryOrder.side,
      size: entryOrder.size,
      price: fillPrice,
      time: last(state.asset.series).time,
    },
    state.commissionProvider
  );

  const transactions = state.asset.transactions.concat(transaction);

  const position: MarketPosition = {
    side: transaction.side === "buy" ? "long" : "short",
    size: transaction.size,
  };

  const cash = updateCash(state.cash, transaction);

  return { ...state, asset: { ...state.asset, transactions, position }, cash };
}

function fulfillExitOrder(
  state: OrderHandlerState,
  order: Order,
  fillPrice: number
): OrderHandlerState {
  const { series, transactions, trades } = state.asset;
  const transaction = withCommission(
    {
      side: order.side,
      size: order.size,
      price: fillPrice,
      time: last(series).time,
    },
    state.commissionProvider
  );
  const cash = updateCash(state.cash, transaction);

  const trade: Trade = convertToTrade({
    symbol: state.asset.symbol,
    entry: last(transactions),
    exit: transaction,
  });
  return {
    ...state,
    asset: {
      ...state.asset,
      transactions: transactions.concat(transaction),
      trades: trades.concat(trade),
      position: null,
      entryOrder: null,
      stopLoss: null,
      takeProfit: null,
    },
    cash,
  };
}

function updateCash(cashBefore: number, transaction: Transaction) {
  return cashBefore + getCashChange(transaction);
}

function getCashChange(transaction: Transaction) {
  const positionSizeInCash = transaction.size * transaction.price;
  const cashChange =
    transaction.side === "buy" ? -positionSizeInCash : positionSizeInCash;
  return cashChange - transaction.commission;
}

function convertToTrade({
  symbol,
  entry,
  exit,
}: {
  symbol: string;
  entry: Transaction;
  exit: Transaction;
}): Trade {
  const side = entry.side === "buy" ? "long" : "short";
  const size = entry.size;
  if (exit.size !== size) {
    throw Error(
      "Entry and exit orders have different sizes. " +
        "This indicates a bug in the backtester."
    );
  }

  const entryValue = entry.price * size;
  const exitValue = exit.price * size;

  const absoluteProfit =
    (side === "long" ? exitValue - entryValue : entryValue - exitValue) -
    entry.commission -
    exit.commission;

  const relativeProfit = absoluteProfit / entryValue;
  return {
    symbol,
    entry,
    exit,
    position: { side, size },
    absoluteProfit,
    relativeProfit,
  };
}

function withCommission(
  transaction: Omit<Transaction, "commission">,
  commissionProvider: CommissionProvider
): Transaction {
  const commission = commissionProvider(transaction);
  if (commission < 0) {
    throw Error("Commission provider returned a negative commission.");
  }
  return { ...transaction, commission };
}

/**
 * Use to revert the effect of un-closed trade after the backtest finishes.
 * Removes the last transaction and reverts the cash balance to the value before
 * the transaction. Returns the updated asset state and cash balance.
 */
export function revertLastTransaction(state: AssetAndCash): AssetAndCash {
  const transactions = state.asset.transactions;
  const cash = state.cash - getCashChange(last(transactions));
  return {
    ...state,
    asset: {
      ...state.asset,
      transactions: dropLast(transactions, 1),
      position: null,
    },
    cash,
  };
}
