import { m } from "../shared/functions";
import { Moment } from "../shared/time-util";
import { startProgressBar } from "../util";
import { BacktestResult, convertToBacktestResult } from "./backtest-result";
import { TimeTraveller } from "./time-traveller";
import {
  Candle,
  CandleSeries,
  MarketPosition,
  Order,
  Strategy,
  TradeState,
  Transaction,
} from "./types";

export const usedStrats = new WeakSet<Strategy>();

/**
 * Tests how the given strategy would have performed with
 * the provided historical price data.
 *
 * @param stratProvider the provider for the strategy to test
 * @param series data series covering at least the range
 * between 'from' and 'to' arguments, plus X time before
 * to have some history for the first values
 * @param from the start of the time range to test
 * as unix timestamp, inclusive
 * @param to the end of the time range to test
 * as unix timestamp, exclusive, can be dismissed
 * to test until the end of the series
 */
export function backtestStrategy(args: {
  stratProvider: () => Strategy;
  series: CandleSeries;
  initialBalance?: number;
  showProgressBar?: boolean;
  from?: Moment;
  to?: Moment;
}): BacktestResult {
  const defaults = { initialBalance: 10000, showProgressBar: true };
  const { stratProvider, series, initialBalance, showProgressBar, from, to } = {
    ...defaults,
    ...args,
  };

  if (!series.length) {
    throw Error("Can't backtest with empty series");
  }

  // Strategies are stateful, which is why a new instance is needed for each backtest.
  const strat: Strategy = stratProvider();
  if (usedStrats.has(strat)) {
    // In case the stratProvider returns the same instance many times.
    throw Error(
      "This strategy instance has been backtested already. " +
        "Strategies are often stateful, so backtesting a strategy " +
        "multiple times would cause problems in most cases."
    );
  }
  usedStrats.add(strat);

  const tt = new TimeTraveller(series, from, to);

  const initialState: TradeState = {
    cash: initialBalance,
    series: [],
    entryOrder: null,
    position: null,
    stopLoss: null,
    takeProfit: null,
    transactions: [],
  };

  const progressBar = startProgressBar(tt.length, showProgressBar);

  // Recursion removed to avoid heap out of memory
  let state = initialState;
  while (tt.hasNext()) {
    state = nextState({ ...state, series: tt.next() }, strat);
    progressBar.increment();
  }
  progressBar.stop();

  return convertToBacktestResult(state.transactions, series, tt.range);
}

function nextState(state: TradeState, strat: Strategy): TradeState {
  return applyStrategy(handleOrders(state), strat);
}

function handleOrders(state: TradeState) {
  if (!state.position) {
    return handleOrdersOnEntryCandle(handleEntryOrder(state));
  } else {
    // Could be executed in an order based on candle direction,
    // instead of always running stop loss first.
    return handleTakeProfit(handleStopLoss(state));
  }
}

// Stop loss and take profit need to be handled differently on the candle
// where entry was triggered.
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
  // If the candle was green, assume that only prices above the entry price
  // are covered after the entry, and vice versa.
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

function applyStrategy(state: TradeState, strat: Strategy) {
  const mutations = strat(state);
  if (mutations.entryOrder && mutations.entryOrder.size <= 0) {
    throw Error("Order size must be positive.");
  }
  if (state.position && mutations.entryOrder) {
    throw Error(
      "Changing entry order while already in a position is not allowed."
    );
  }
  return { ...state, ...mutations };
}

/**
 * If the order should become fulfilled with the new candle, returns
 * the price where the transaction took place. Otherwise returns null.
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
    order: entryOrder,
    side: entryOrder.side,
    price: executionPrice,
    time: m.last(state.series).time,
  };

  const transactions = state.transactions.concat(transaction);

  const position: MarketPosition = entryOrder.side === "buy" ? "long" : "short";

  const cash = getCashBalanceAfterOrder({
    order: entryOrder,
    executionPrice,
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
    order,
    side: order.side,
    price: executionPrice,
    time: m.last(state.series).time,
  };
  const cash = getCashBalanceAfterOrder({
    order,
    executionPrice,
    cashBefore: state.cash,
  });
  return {
    transactions: state.transactions.concat(transaction),
    position: null,
    entryOrder: null,
    stopLoss: null,
    takeProfit: null,
    cash,
  };
}

function getCashBalanceAfterOrder({
  order,
  executionPrice,
  cashBefore,
}: {
  order: Order;
  executionPrice: number;
  cashBefore: number;
}) {
  const positionSizeUsd = order.size * executionPrice;
  return order.side === "buy"
    ? cashBefore - positionSizeUsd
    : cashBefore + positionSizeUsd;
}
