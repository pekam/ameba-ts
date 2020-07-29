import { Strategy, TradeState, Order, Transaction, MarketPosition, Trade, Candle } from "./types";
import { CandleSeries, TimeTraveller } from "./CandleSeries";

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
export function backtestStrategy(strat: Strategy, series: CandleSeries,
  from: number, to?: number): Trade[] {

  const tt = series.getTimeTraveller(from, to);

  const initialState: TradeState = {
    series: null,
    entryOrder: null,
    position: null,
    stopLoss: null,
    takeProfit: null,
    transactions: []
  }

  const finalState = nextState(initialState, tt, strat);

  return convertToTrades(finalState.transactions);
}

function nextState(state: TradeState, tt: TimeTraveller,
  strat: Strategy): TradeState {

  if (!tt.hasNext()) {
    return state;
  }

  return nextState(
    applyStrategy(
      handleTakeProfit(
        handleStopLoss(
          handleEntryOrder(
            { ...state, series: tt.next() }
          ))),
      strat),
    tt, strat);
}

function handleEntryOrder(state: TradeState) {
  if (!state.position && state.entryOrder &&
    isOrderFulfilled(state.entryOrder, state.series.last)) {
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
  if (state.position && mutations.entryOrder) {
    throw new Error('Changing entry order while already ' +
      'in a position is not allowed.');
  }
  return { ...state, ...mutations };
}

function isOrderFulfilled(order: Order, newCandle: Candle): boolean {

  const priceBelowOrder = newCandle.low <= order.price;
  const priceAboveOrder = newCandle.high >= order.price;

  return (!order.sell && order.type === 'limit' && priceBelowOrder)
    || (!order.sell && order.type === 'stop' && priceAboveOrder)
    || (order.sell && order.type === 'limit' && priceAboveOrder)
    || (order.sell && order.type === 'stop' && priceBelowOrder)
}

function fulfillEntryOrder(state: TradeState) {
  const transaction = createTransaction(
    state.entryOrder, state.series.last.time);

  const transactions = state.transactions.concat(transaction);

  const position: MarketPosition =
    state.entryOrder.sell ? 'short' : 'long';

  return { transactions, position }
}

function createTransaction(order: Order, time: number): Transaction {
  return {
    sell: order.sell,
    order,
    price: order.price, // ignoring slippage
    time
  }
}

function createStopLossOrder(state: TradeState): Order {
  return {
    price: state.stopLoss,
    type: 'stop',
    sell: state.position === 'long'
  }
}

function createTakeProfitOrder(state: TradeState): Order {
  return {
    price: state.takeProfit,
    type: 'limit',
    sell: state.position === 'long'
  }
}

function fulfillExitOrder(order: Order, state: TradeState) {
  const transaction: Transaction = createTransaction(
    order, state.series.last.time);
  return {
    transactions: state.transactions.concat(transaction),
    position: null,
    entryOrder: null,
    stopLoss: null,
    takeProfit: null
  }
}

function convertToTrades(transactions: Transaction[]): Trade[] {
  return transactions
    // Every other transaction is an exit.
    // If the last entry didn't close, it's ignored.
    .filter((_, i) => i % 2 === 1)
    .map((exit, i) => {
      const entry = transactions[i * 2];
      const position = entry.sell ? 'short' : 'long';
      const profit = entry.sell ?
        (entry.price - exit.price) / entry.price
        : (exit.price - entry.price) / entry.price;
      return { entry, exit, position, profit }
    });
}
