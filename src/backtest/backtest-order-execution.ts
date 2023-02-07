import { minBy } from "lodash";
import {
  concat,
  drop,
  dropLast,
  filter,
  isDefined,
  map,
  maxBy,
  pipe,
} from "remeda";
import {
  AssetState,
  Candle,
  MarketPosition,
  Order,
  Trade,
  Transaction,
} from "../core/types";
import { last } from "../util/util";
import { CommissionProvider } from "./backtest";

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
 * Internally simulating OTO (one-triggers-other) and OCO (one-cancels-other)
 * orders.
 */
type EnhancedOrder = Order & {
  /**
   * Orders that should be opened when this order is filled (if this is an OTO
   * order).
   */
  triggers: EnhancedOrder[];
  /**
   * True if all other open orders should be cancelled when this order is filled
   * (if this is an OCO order).
   *
   * Ideally this would also be a list of orders to cancel, but that would
   * create circular reference among stoploss and takeprofit, so introducing
   * order identifiers would be required for that. The current approach works
   * while the strategy function enforces that the only possible case for
   * multiple open orders is stoploss + takeprofit.
   */
  cancelsOthers: boolean;
};

type PricePath = { from: number; to: number };

function toPricePath([from, to]: [number, number]): PricePath {
  return { from, to };
}

function toPricePaths({ open, high, low, close }: Candle): PricePath[] {
  const isGreen = close > open;
  if (isGreen) {
    return [
      [open, low],
      [low, high],
      [high, close],
    ].map(toPricePath);
  } else {
    return [
      [open, high],
      [high, low],
      [low, close],
    ].map(toPricePath);
  }
}

export function handleOrders(state: OrderHandlerState): OrderHandlerState {
  const openOrders = getOpenOrders(state.asset);
  const candle = last(state.asset.series);
  const pricePaths = toPricePaths(candle);

  return fillOrders(state, openOrders, pricePaths);
}

function fillOrders(
  state: OrderHandlerState,
  openOrders: EnhancedOrder[],
  pricePaths: PricePath[]
): OrderHandlerState {
  if (!openOrders.length || !pricePaths.length) {
    return state;
  }

  const path = pricePaths[0];
  const directionUp = path.from < path.to;

  const orderToFill: { orderIndex: number; fillPrice: number } | undefined =
    pipe(
      openOrders,
      map.indexed((order, index) => {
        const fillPrice = getFillPrice(order, path);
        return fillPrice ? { orderIndex: index, fillPrice } : undefined;
      }),
      filter(isDefined),
      (fillableOrders) =>
        directionUp
          ? minBy(fillableOrders, (o) => o.fillPrice)
          : maxBy(fillableOrders, (o) => o.fillPrice)
    );

  if (!orderToFill) {
    return fillOrders(state, openOrders, drop(pricePaths, 1));
  }

  const { orderIndex, fillPrice } = orderToFill;
  const order = openOrders[orderIndex];

  const nextState = !state.asset.position
    ? fulfillEntryOrder(state, order, fillPrice)
    : fulfillExitOrder(state, order, fillPrice);

  const nextOpenOrders = pipe(
    openOrders,
    filter.indexed((_, index) => index !== orderIndex),
    (orders) => (order.cancelsOthers ? [] : orders),
    concat(order.triggers)
  );

  const nextPricePaths = splitFirstPricePath(pricePaths, fillPrice);

  return fillOrders(nextState, nextOpenOrders, nextPricePaths);
}

function splitFirstPricePath(
  pricePaths: PricePath[],
  splitAt: number
): PricePath[] {
  const newFirst: PricePath = { from: splitAt, to: pricePaths[0].to };
  return [newFirst, ...drop(pricePaths, 1)];
}

function getOpenOrders(asset: AssetState): EnhancedOrder[] {
  const exitOrders: EnhancedOrder[] = filter(
    [getStopLossOrder(asset), getTakeProfitOrder(asset)],
    isDefined
  );
  if (!asset.position) {
    if (!asset.entryOrder) {
      return [];
    }
    return [
      {
        ...asset.entryOrder,
        triggers: exitOrders,
        cancelsOthers: false,
      },
    ];
  } else {
    return exitOrders;
  }
}

/**
 * If the order should have been filled when the asset has traded along the
 * given path, returns the price where the transaction took place. Otherwise
 * returns null.
 *
 * The price ignores slippage except that caused by gaps between previous
 * candle's close and current candle's open.
 */
function getFillPrice(order: Order, pricePath: PricePath): number | null {
  if (order.type === "market") {
    return pricePath.from;
  }

  const priceBelowOrder = Math.min(pricePath.from, pricePath.to) <= order.price;
  if (priceBelowOrder) {
    const buyPriceCrossed = order.side === "buy" && order.type === "limit";
    const sellPriceCrossed = order.side === "sell" && order.type === "stop";
    if (buyPriceCrossed || sellPriceCrossed) {
      return Math.min(order.price, pricePath.from);
    }
  }

  const priceAboveOrder = Math.max(pricePath.from, pricePath.to) >= order.price;
  if (priceAboveOrder) {
    const buyPriceCrossed = order.side === "buy" && order.type === "stop";
    const sellPriceCrossed = order.side === "sell" && order.type === "limit";
    if (buyPriceCrossed || sellPriceCrossed) {
      return Math.max(order.price, pricePath.from);
    }
  }

  return null;
}

function getStopLossOrder(asset: AssetState): EnhancedOrder | undefined {
  if (!asset.stopLoss) {
    return undefined;
  }
  const sideAndSize = getSideAndSizeForExit(asset);
  if (!sideAndSize) {
    return undefined;
  }
  return {
    price: asset.stopLoss,
    type: "stop",
    ...sideAndSize,
    triggers: [],
    cancelsOthers: true,
  };
}

function getTakeProfitOrder(asset: AssetState): EnhancedOrder | undefined {
  if (!asset.takeProfit) {
    return undefined;
  }
  const sideAndSize = getSideAndSizeForExit(asset);
  if (!sideAndSize) {
    return undefined;
  }
  return {
    price: asset.takeProfit,
    type: "limit",
    ...sideAndSize,
    triggers: [],
    cancelsOthers: true,
  };
}

function getSideAndSizeForExit({
  position,
  entryOrder,
}: AssetState): Pick<Order, "side" | "size"> | null {
  // entryOrder should be available also when in position but this is more
  // future-proof
  if (position) {
    return {
      side: position.side === "long" ? "sell" : "buy",
      size: position.size,
    };
  } else if (entryOrder) {
    return {
      side: entryOrder.side === "buy" ? "sell" : "buy",
      size: entryOrder.size,
    };
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
