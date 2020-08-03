import {
  MarketPosition,
  Order,
  Strategy,
  TradeState,
  Transaction,
} from "./types";
import { Candle, CandleSeries, TimeTraveller } from "./candle-series";
import { BacktestResult, convertToBacktestResult } from "./backtest-result";
import { applyIf } from "../util";
import { Presets, SingleBar } from "cli-progress";

/**
 * Tests how the given strategy would have performed with
 * the provided historical price data.
 *
 * @param strat the strategy to test
 * @param series data series covering at least the range
 * between 'from' and 'to' arguments, plus X time before
 * to have some history for the first values
 * @param from the start of the time range to test
 * as unix timestamp, inclusive
 * @param to the end of the time range to test
 * as unix timestamp, exclusive, can be dismissed
 * to test until the end of the series
 */
export function backtestStrategy(
  strat: Strategy,
  series: CandleSeries,
  from: number,
  to?: number
): BacktestResult {
  const tt = series.getTimeTraveller(from, to);

  const initialState: TradeState = {
    series: null,
    entryOrder: null,
    position: null,
    stopLoss: null,
    takeProfit: null,
    transactions: [],
  };

  console.log("Backtesting");
  const progressBar = new SingleBar({}, Presets.shades_classic);
  progressBar.start(tt.length, 0);

  // Recursion removed to avoid heap out of memory
  let state = initialState;
  while (tt.hasNext()) {
    state = nextState(state, tt, strat);
    progressBar.increment();
  }
  progressBar.stop();

  return convertToBacktestResult(state.transactions, series);
}

function nextState(
  state: TradeState,
  tt: TimeTraveller,
  strat: Strategy
): TradeState {
  return applyStrategy(handleOrders({ ...state, series: tt.next() }), strat);
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
  return applyIf(
    shouldHandleOrderOnEntryCandle(state, state.takeProfit),
    handleTakeProfit,
    applyIf(
      shouldHandleOrderOnEntryCandle(state, state.stopLoss),
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
    state.series.last.close > state.series.last.open;
  const entryPrice = state.entryOrder.price;

  return (
    (priceMovedUp && orderPrice > entryPrice) ||
    (!priceMovedUp && orderPrice < entryPrice)
  );
}

function handleEntryOrder(state: TradeState) {
  if (
    !state.position &&
    state.entryOrder &&
    isOrderFulfilled(state.entryOrder, state.series.last)
  ) {
    const mutations = fulfillEntryOrder(state);
    return { ...state, ...mutations };
  }
  return state;
}

function handleStopLoss(state: TradeState) {
  if (state.position && state.stopLoss) {
    const stopLossOrder: Order = createStopLossOrder(state);
    if (isOrderFulfilled(stopLossOrder, state.series.last)) {
      const mutations = fulfillExitOrder(stopLossOrder, state);
      return { ...state, ...mutations };
    }
  }
  return state;
}

function handleTakeProfit(state: TradeState) {
  if (state.position && state.takeProfit) {
    const takeProfitOrder: Order = createTakeProfitOrder(state);
    if (isOrderFulfilled(takeProfitOrder, state.series.last)) {
      const mutations = fulfillExitOrder(takeProfitOrder, state);
      return { ...state, ...mutations };
    }
  }
  return state;
}

function applyStrategy(state: TradeState, strat: Strategy) {
  const mutations = strat(state);
  if (state.position && mutations && mutations.entryOrder) {
    throw new Error(
      "Changing entry order while already in a position is not allowed."
    );
  }
  return { ...state, ...mutations };
}

function isOrderFulfilled(order: Order, newCandle: Candle): boolean {
  const priceBelowOrder = newCandle.low <= order.price;
  const priceAboveOrder = newCandle.high >= order.price;

  return (
    (!order.sell && order.type === "limit" && priceBelowOrder) ||
    (!order.sell && order.type === "stop" && priceAboveOrder) ||
    (order.sell && order.type === "limit" && priceAboveOrder) ||
    (order.sell && order.type === "stop" && priceBelowOrder)
  );
}

function fulfillEntryOrder(state: TradeState) {
  const transaction = createTransaction(
    state.entryOrder,
    state.series.last.time
  );

  const transactions = state.transactions.concat(transaction);

  const position: MarketPosition = state.entryOrder.sell ? "short" : "long";

  return { transactions, position };
}

function createTransaction(order: Order, time: number): Transaction {
  return {
    sell: order.sell,
    order,
    price: order.price, // ignoring slippage
    time,
  };
}

function createStopLossOrder(state: TradeState): Order {
  return {
    price: state.stopLoss,
    type: "stop",
    sell: state.position === "long",
  };
}

function createTakeProfitOrder(state: TradeState): Order {
  return {
    price: state.takeProfit,
    type: "limit",
    sell: state.position === "long",
  };
}

function fulfillExitOrder(order: Order, state: TradeState) {
  const transaction: Transaction = createTransaction(
    order,
    state.series.last.time
  );
  return {
    transactions: state.transactions.concat(transaction),
    position: null,
    entryOrder: null,
    stopLoss: null,
    takeProfit: null,
  };
}
