import { m } from "../shared/functions";
import { AssetState } from "./backtest";
import { Candle, MarketPosition, Order, Trade, Transaction } from "./types";

// This module deals with the combination of a single asset's state (position,
// orders, candles, etc.) and the account's cash balance.
interface State {
  asset: AssetState;
  cash: number;
}

/**
 * Takes the latest candle in the series and executes orders in the state based
 * on those price changes. Returns the updated asset state and cash balance.
 */
export function handleOrders(state: State): State {
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
function handleOrdersOnEntryCandle(state: State): State {
  const { position, takeProfit, stopLoss } = state.asset;
  if (!position) {
    // Entry not triggered.
    return state;
  }
  return m.applyIf(
    !!takeProfit && shouldHandleOrderOnEntryCandle(state, takeProfit),
    handleTakeProfit,
    m.applyIf(
      !!stopLoss && shouldHandleOrderOnEntryCandle(state, stopLoss),
      handleStopLoss,
      state
    )
  );
}

function shouldHandleOrderOnEntryCandle(
  state: State,
  orderPrice: number
): boolean {
  const { series, entryOrder } = state.asset;
  // If the candle was green, assume that only prices above the entry price are
  // covered after the entry, and vice versa.
  const priceMovedUp: boolean = m.last(series).close > m.last(series).open;
  // entryOrder is definitely non-null right after entering
  const entryPrice = entryOrder!.price;

  return (
    (priceMovedUp && orderPrice > entryPrice) ||
    (!priceMovedUp && orderPrice < entryPrice)
  );
}

function handleEntryOrder(state: State): State {
  const { position, entryOrder, series } = state.asset;
  if (!position && entryOrder) {
    const price = isOrderFulfilled(entryOrder, m.last(series));
    if (price) {
      return fulfillEntryOrder(state, entryOrder, price);
    }
  }
  return state;
}

function handleStopLoss(state: State): State {
  const { position, entryOrder, stopLoss, series } = state.asset;
  if (position && stopLoss) {
    const stopLossOrder: Order = {
      price: stopLoss,
      type: "stop",
      side: position === "long" ? "sell" : "buy",
      size: entryOrder!.size, // entryOrder must exist when in position
    };
    const price = isOrderFulfilled(stopLossOrder, m.last(series));
    if (price) {
      return fulfillExitOrder(state, stopLossOrder, price);
    }
  }
  return state;
}

function handleTakeProfit(state: State): State {
  const { position, entryOrder, takeProfit, series } = state.asset;
  if (position && takeProfit) {
    const takeProfitOrder: Order = {
      price: takeProfit,
      type: "limit",
      side: position === "long" ? "sell" : "buy",
      size: entryOrder!.size, // entryOrder must exist when in position
    };
    const price = isOrderFulfilled(takeProfitOrder, m.last(series));
    if (price) {
      return fulfillExitOrder(state, takeProfitOrder, price);
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
function isOrderFulfilled(order: Order, newCandle: Candle): number | null {
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
  state: State,
  entryOrder: Order,
  executionPrice: number
): State {
  const transaction: Transaction = {
    side: entryOrder.side,
    size: entryOrder.size,
    price: executionPrice,
    time: m.last(state.asset.series).time,
  };

  const transactions = state.asset.transactions.concat(transaction);

  const position: MarketPosition = entryOrder.side === "buy" ? "long" : "short";

  const cash = getCashBalanceAfterTransaction({
    transaction,
    cashBefore: state.cash,
  });

  return { asset: { ...state.asset, transactions, position }, cash };
}

function fulfillExitOrder(
  state: State,
  order: Order,
  executionPrice: number
): State {
  const { series, transactions, trades } = state.asset;
  const transaction: Transaction = {
    side: order.side,
    size: order.size,
    price: executionPrice,
    time: m.last(series).time,
  };
  const cash = getCashBalanceAfterTransaction({
    transaction,
    cashBefore: state.cash,
  });
  const trade: Trade = convertToTrade({
    symbol: state.asset.symbol,
    entry: m.last(transactions),
    exit: transaction,
  });
  return {
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

function getCashBalanceAfterTransaction({
  transaction,
  cashBefore,
}: {
  transaction: Transaction;
  cashBefore: number;
}) {
  const positionSizeUsd = transaction.size * transaction.price;
  return transaction.side === "buy"
    ? cashBefore - positionSizeUsd
    : cashBefore + positionSizeUsd;
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
  const position = entry.side === "buy" ? "long" : "short";
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
    position === "long" ? exitValue - entryValue : entryValue - exitValue;

  const relativeProfit = absoluteProfit / entryValue;
  return {
    symbol,
    entry,
    exit,
    position,
    absoluteProfit,
    relativeProfit,
  };
}

/**
 * Use to revert the effect of un-closed trade after the backtest finishes.
 * Removes the last transaction and reverts the cash balance to the value before
 * the transaction. Returns the updated asset state and cash balance.
 */
export function revertLastTransaction(state: State): State {
  // NOTE: If/when transaction costs are added to the backtester, this needs to
  // be updated to revert those as well.

  const transactions = state.asset.transactions;
  const lastTransaction = m.last(transactions);

  const oppositeTransaction: Transaction = {
    ...lastTransaction,
    side: lastTransaction.side === "buy" ? "sell" : "buy",
  };
  const cash = getCashBalanceAfterTransaction({
    transaction: oppositeTransaction,
    cashBefore: state.cash,
  });
  return {
    asset: {
      ...state.asset,
      transactions: transactions.slice(0, transactions.length - 1),
      position: null,
    },
    cash,
  };
}
