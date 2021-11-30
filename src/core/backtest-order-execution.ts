import { m } from "../shared/functions";
import {
  Candle,
  MarketPosition,
  Order,
  Trade,
  TradeState,
  Transaction,
} from "./types";

/**
 * Takes the latest candle in the series and executes orders in the state based
 * on those price changes. Returns the updated state.
 */
export function handleOrders(state: TradeState): TradeState {
  if (!state.position) {
    return handleOrdersOnEntryCandle(handleEntryOrder(state));
  } else {
    // Could be executed in an order based on candle direction, instead of
    // always running stop loss first.
    return handleTakeProfit(handleStopLoss(state));
  }
}

// Stop loss and take profit need to be handled differently on the candle where
// entry was triggered.
function handleOrdersOnEntryCandle(state: TradeState): TradeState {
  if (!state.position) {
    // Entry not triggered.
    return state;
  }
  return m.applyIf(
    !!state.takeProfit &&
      shouldHandleOrderOnEntryCandle(state, state.takeProfit),
    handleTakeProfit,
    m.applyIf(
      !!state.stopLoss && shouldHandleOrderOnEntryCandle(state, state.stopLoss),
      handleStopLoss,
      state
    )
  );
}

function shouldHandleOrderOnEntryCandle(
  state: TradeState,
  orderPrice: number
): boolean {
  // If the candle was green, assume that only prices above the entry price are
  // covered after the entry, and vice versa.
  const priceMovedUp: boolean =
    m.last(state.series).close > m.last(state.series).open;
  // entryOrder is definitely non-null right after entering
  const entryPrice = (state.entryOrder as Order).price;

  return (
    (priceMovedUp && orderPrice > entryPrice) ||
    (!priceMovedUp && orderPrice < entryPrice)
  );
}

function handleEntryOrder(state: TradeState) {
  if (!state.position && state.entryOrder) {
    const price = isOrderFulfilled(state.entryOrder, m.last(state.series));
    if (price) {
      const mutations = fulfillEntryOrder(state, state.entryOrder, price);
      return { ...state, ...mutations };
    }
  }
  return state;
}

function handleStopLoss(state: TradeState) {
  if (state.position && state.stopLoss) {
    const stopLossOrder: Order = {
      price: state.stopLoss,
      type: "stop",
      side: state.position === "long" ? "sell" : "buy",
      size: state.entryOrder!.size, // entryOrder must exist when in position
    };
    const price = isOrderFulfilled(stopLossOrder, m.last(state.series));
    if (price) {
      const mutations = fulfillExitOrder(stopLossOrder, state, price);
      return { ...state, ...mutations };
    }
  }
  return state;
}

function handleTakeProfit(state: TradeState) {
  if (state.position && state.takeProfit) {
    const takeProfitOrder: Order = {
      price: state.takeProfit,
      type: "limit",
      side: state.position === "long" ? "sell" : "buy",
      size: state.entryOrder!.size, // entryOrder must exist when in position
    };
    const price = isOrderFulfilled(takeProfitOrder, m.last(state.series));
    if (price) {
      const mutations = fulfillExitOrder(takeProfitOrder, state, price);
      return { ...state, ...mutations };
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
  state: TradeState,
  entryOrder: Order,
  executionPrice: number
) {
  const transaction: Transaction = {
    side: entryOrder.side,
    size: entryOrder.size,
    price: executionPrice,
    time: m.last(state.series).time,
  };

  const transactions = state.transactions.concat(transaction);

  const position: MarketPosition = entryOrder.side === "buy" ? "long" : "short";

  const cash = getCashBalanceAfterTransaction({
    transaction,
    cashBefore: state.cash,
  });

  return { transactions, position, cash };
}

function fulfillExitOrder(
  order: Order,
  state: TradeState,
  executionPrice: number
) {
  const transaction: Transaction = {
    side: order.side,
    size: order.size,
    price: executionPrice,
    time: m.last(state.series).time,
  };
  const cash = getCashBalanceAfterTransaction({
    transaction,
    cashBefore: state.cash,
  });
  const trade: Trade = convertToTrade({
    entry: m.last(state.transactions),
    exit: transaction,
  });
  return {
    transactions: state.transactions.concat(transaction),
    trades: state.trades.concat(trade),
    position: null,
    entryOrder: null,
    stopLoss: null,
    takeProfit: null,
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
  entry,
  exit,
}: {
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
 * the transaction. Returns the updated state.
 */
export function revertLastTransaction(state: TradeState): TradeState {
  // NOTE: If/when transaction costs are added to the backtester, this needs to
  // be updated to revert those as well.

  const transaction = m.last(state.transactions);
  const oppositeTransaction: Transaction = {
    ...transaction,
    side: transaction.side === "buy" ? "sell" : "buy",
  };
  const cash = getCashBalanceAfterTransaction({
    transaction: oppositeTransaction,
    cashBefore: state.cash,
  });
  const transactions = state.transactions.slice(
    0,
    state.transactions.length - 1
  );
  return { ...state, cash, transactions, position: null };
}
