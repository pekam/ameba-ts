import { Moment } from "../shared/time-util";
import { startProgressBar } from "../util";
import {
  handleOrders,
  revertLastTransaction,
} from "./backtest-order-execution";
import { BacktestResult, convertToBacktestResult } from "./backtest-result";
import { TimeTraveller } from "./time-traveller";
import { CandleSeries, Strategy, TradeState } from "./types";

const usedStrats = new WeakSet<Strategy>();

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
    trades: [],
  };

  const progressBar = startProgressBar(tt.length, showProgressBar);

  // Recursion removed to avoid heap out of memory
  let state = initialState;
  while (tt.hasNext()) {
    state = nextState({ ...state, series: tt.next() }, strat);
    progressBar.increment();
  }
  progressBar.stop();

  if (state.position) {
    state = revertLastTransaction(state);
  }

  return convertToBacktestResult(
    state.trades,
    [series],
    initialBalance,
    state.cash,
    tt.range
  );
}

function nextState(state: TradeState, strat: Strategy): TradeState {
  return applyStrategy(handleOrders(state), strat);
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
