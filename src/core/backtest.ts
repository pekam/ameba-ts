import {
  MarketPosition,
  Order,
  Strategy,
  TradeState,
  Transaction,
} from "./types";
import { Candle, CandleSeries } from "./candle-series";
import { BacktestResult, convertToBacktestResult } from "./backtest-result";
import { applyIf, startProgressBar } from "../util";

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
export function backtestStrategy(
  stratProvider: () => Strategy,
  series: CandleSeries,
  showProgressBar = true,
  from?: number,
  to?: number
): BacktestResult {
  // Strategies are stateful, which is why a new instance is needed
  // for each backtest.
  const strat: Strategy = stratProvider();

  const tt = series.getTimeTraveller(from, to);

  const initialState: TradeState = {
    series: null,
    entryOrder: null,
    position: null,
    stopLoss: null,
    takeProfit: null,
    transactions: [],
  };

  const progressBar = startProgressBar(tt.length, showProgressBar);

  // Recursion removed to avoid heap out of memory
  let state = initialState;
  let initCalled = false;
  while (tt.hasNext()) {
    const stateWithNewCandles = { ...state, series: tt.next() };
    if (!initCalled) {
      strat.init(stateWithNewCandles);
      initCalled = true;
    }
    state = nextState(stateWithNewCandles, strat);
    progressBar.increment();
  }
  progressBar.stop();

  return convertToBacktestResult(state.transactions, series);
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
  if (!state.position && state.entryOrder) {
    const price = isOrderFulfilled(state.entryOrder, state.series.last);
    if (price) {
      const mutations = fulfillEntryOrder(state, price);
      return { ...state, ...mutations };
    }
  }
  return state;
}

function handleStopLoss(state: TradeState) {
  if (state.position && state.stopLoss) {
    const stopLossOrder: Order = createStopLossOrder(state);
    const price = isOrderFulfilled(stopLossOrder, state.series.last);
    if (price) {
      const mutations = fulfillExitOrder(stopLossOrder, state, price);
      return { ...state, ...mutations };
    }
  }
  return state;
}

function handleTakeProfit(state: TradeState) {
  if (state.position && state.takeProfit) {
    const takeProfitOrder: Order = createTakeProfitOrder(state);
    const price = isOrderFulfilled(takeProfitOrder, state.series.last);
    if (price) {
      const mutations = fulfillExitOrder(takeProfitOrder, state, price);
      return { ...state, ...mutations };
    }
  }
  return state;
}

function applyStrategy(state: TradeState, strat: Strategy) {
  const mutations = strat.update(state);
  if (state.position && mutations && mutations.entryOrder) {
    throw new Error(
      "Changing entry order while already in a position is not allowed."
    );
  }
  return { ...state, ...mutations };
}

/**
 * If the order should become fulfilled with the new candle, returns
 * the price where the transaction took place. Otherwise returns undefined.
 *
 * The price ignores slippage except that caused by gaps between previous
 * candle's close and current candle's open.
 */
function isOrderFulfilled(order: Order, newCandle: Candle): number {
  const priceBelowOrder = newCandle.low <= order.price;
  if (priceBelowOrder) {
    const buyPriceCrossed = !order.sell && order.type === "limit";
    const sellPriceCrossed = order.sell && order.type === "stop";
    if (buyPriceCrossed || sellPriceCrossed) {
      return Math.min(order.price, newCandle.open);
    }
  }

  const priceAboveOrder = newCandle.high >= order.price;
  if (priceAboveOrder) {
    const buyPriceCrossed = !order.sell && order.type === "stop";
    const sellPriceCrossed = order.sell && order.type === "limit";
    if (buyPriceCrossed || sellPriceCrossed) {
      return Math.max(order.price, newCandle.open);
    }
  }
}

function fulfillEntryOrder(state: TradeState, price: number) {
  const transaction: Transaction = {
    order: state.entryOrder,
    sell: state.entryOrder.sell,
    price,
    time: state.series.last.time,
  };

  const transactions = state.transactions.concat(transaction);

  const position: MarketPosition = state.entryOrder.sell ? "short" : "long";

  return { transactions, position };
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

function fulfillExitOrder(order: Order, state: TradeState, price: number) {
  const transaction: Transaction = {
    order,
    sell: order.sell,
    price,
    time: state.series.last.time,
  };
  return {
    transactions: state.transactions.concat(transaction),
    position: null,
    entryOrder: null,
    stopLoss: null,
    takeProfit: null,
  };
}
