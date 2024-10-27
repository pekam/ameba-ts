import {
  concat,
  drop,
  dropLast,
  filter,
  isDefined,
  map,
  maxBy,
  minBy,
  pipe,
} from "remeda";
import {
  AssetState,
  Candle,
  MarketPosition,
  Order,
  OrderType,
  Trade,
  Transaction,
} from "../core/types";
import {
  balanceToMarketPosition,
  marketPositionToBalance,
} from "../util/conversions";
import { shouldFillImmediately } from "../util/order-util";
import { Nullable } from "../util/type-util";
import { last } from "../util/util";
import { CommissionProvider } from "./backtest";

interface AssetAndCash {
  asset: AssetState;
  cash: number;
}

export interface OrderHandlerArgs extends AssetAndCash {
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

/**
 * Represents linear movement from one price point to another. A candle is split
 * to these so we can determine which orders are filled and in which order.
 */
type PricePath = { from: number; to: number };

/**
 * The price is expected to have changed in three linear moves within a candle:
 * from open to low, low to high, high to close (for green candles, red candles
 * visit first high and then low).
 */
function toPricePaths({ open, high, low, close }: Candle): PricePath[] {
  const isGreen = close > open;
  if (isGreen) {
    return [
      { from: open, to: low },
      { from: low, to: high },
      { from: high, to: close },
    ];
  } else {
    return [
      { from: open, to: high },
      { from: high, to: low },
      { from: low, to: close },
    ];
  }
}

/**
 * Updates the asset state and cash by filling any orders that should be filled
 * with the latest candle.
 */
export function handleOrders(args: OrderHandlerArgs): AssetAndCash {
  const { asset, commissionProvider } = args;
  const openOrders = getOpenOrders(asset);
  const candle = last(asset.series);
  const pricePaths = toPricePaths(candle);

  const newTransactions = fillOrders({
    time: candle.time,
    commissionProvider: commissionProvider,

    openOrders,
    pricePaths,
    transactions: [],
  });

  const cash = newTransactions.reduce(updateCash, args.cash);
  const position = newTransactions.reduce(updatePosition, asset.position);
  const transactions = asset.transactions.concat(newTransactions);

  const positionExited = newTransactions.length && !position;
  const exitUpdates: Partial<AssetState> = positionExited
    ? {
        trades: asset.trades.concat(
          convertToTrade({
            symbol: asset.symbol,
            entry: transactions[transactions.length - 2],
            exit: transactions[transactions.length - 1],
          })
        ),
        entryOrder: null,
        stopLoss: null,
        takeProfit: null,
      }
    : {};

  return {
    asset: {
      ...asset,
      position,
      transactions,
      ...exitUpdates,
    },
    cash,
  };
}

interface OrderFillState {
  openOrders: EnhancedOrder[];
  time: number;
  pricePaths: PricePath[];
  transactions: Transaction[];
  commissionProvider: CommissionProvider;
}

/**
 * Returns transactions of the orders filled by traversing the given price path.
 */
function fillOrders(state: OrderFillState): Transaction[] {
  const { openOrders, pricePaths } = state;
  if (!openOrders.length || !pricePaths.length) {
    return state.transactions;
  }

  const path = pricePaths[0];
  const directionUp = path.from < path.to;

  const nextState: OrderFillState = pipe(
    openOrders,

    // Find all orders which would be filled while traversing the price path
    map.indexed((order, index) => {
      const fillPrice = getFillPrice(order, path);
      return fillPrice ? { orderIndex: index, fillPrice } : undefined;
    }),
    filter(isDefined),

    // If multiple orders could be filled, fill the one whose fill price is
    // visited first
    (fillableOrders) =>
      directionUp
        ? minBy(fillableOrders, (o) => o.fillPrice)
        : maxBy(fillableOrders, (o) => o.fillPrice),

    (orderToFill) =>
      orderToFill
        ? // Update transactions and orders, split the current path
          fillOrder(state, orderToFill)
        : // This path is finished as no orders triggered
          { ...state, pricePaths: drop(pricePaths, 1) }
  );

  return fillOrders(nextState);
}

function fillOrder(
  state: OrderFillState,
  orderToFill: { orderIndex: number; fillPrice: number }
): OrderFillState {
  const { orderIndex, fillPrice } = orderToFill;
  const order = state.openOrders[orderIndex];

  const transaction: Transaction = withCommission(
    {
      side: order.side,
      size: order.size,
      price: fillPrice,
      time: state.time,
    },
    state.commissionProvider
  );

  const nextOpenOrders = pipe(
    state.openOrders,
    // Remove filled order
    filter.indexed((_, index) => index !== orderIndex),
    // Cancel others if OCO
    (orders) => (order.cancelsOthers ? [] : orders),
    // Open others if OTO
    concat(order.triggers)
  );

  // The path is traversed up to the point where an order was filled, and that
  // part should not be revisited for potentially triggered new orders.
  const nextPricePaths = splitFirstPricePath(state.pricePaths, fillPrice);

  return {
    time: state.time,
    commissionProvider: state.commissionProvider,

    openOrders: nextOpenOrders,
    pricePaths: nextPricePaths,
    transactions: state.transactions.concat(transaction),
  };
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
    [
      getExitOrder(asset, asset.stopLoss, "stop"),
      getExitOrder(asset, asset.takeProfit, "limit"),
    ],
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
  const startPrice = pricePath.from;

  if (order.type === "market" || shouldFillImmediately(order, startPrice)) {
    return startPrice;
  }

  return isWithin(order.price, pricePath) ? order.price : null;
}

function isWithin(price: number, { from, to }: PricePath) {
  return price >= Math.min(from, to) && price <= Math.max(from, to);
}

function getExitOrder(
  asset: AssetState,
  price: Nullable<number>,
  type: Exclude<OrderType, "market">
): EnhancedOrder | undefined {
  if (!price) {
    return undefined;
  }
  const sideAndSize = getSideAndSizeForExit(asset);
  if (!sideAndSize) {
    return undefined;
  }
  return {
    price,
    type,
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

function updateCash(cashBefore: number, transaction: Transaction) {
  return cashBefore + getCashChange(transaction);
}

function getCashChange(transaction: Transaction) {
  const positionSizeInCash = transaction.size * transaction.price;
  const cashChange =
    transaction.side === "buy" ? -positionSizeInCash : positionSizeInCash;
  return cashChange - transaction.commission;
}

function updatePosition(
  positionBefore: MarketPosition | null,
  transaction: Transaction
): MarketPosition | null {
  const balanceAfter =
    marketPositionToBalance(positionBefore) +
    (transaction.side === "buy" ? transaction.size : -transaction.size);
  return balanceToMarketPosition(balanceAfter);
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
