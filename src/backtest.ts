import { Strategy, TradeState } from "./strategy";
import { CandleSeries } from "./CandleSeries";

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
  from: number, to?: number) {

  const tt = series.getTimeTraveller(from);

  const state: TradeState = {
    series: null,
    entryOrder: null,
    position: null,
    stopLoss: null,
    takeProfit: null
  }

  while (tt.hasNext()) {
    // Get a subseries of the full candle data, expanding it
    // by one candle on each iteration.
    const currentSeries = tt.next();
    if (to && currentSeries.last.time.getTime() >= to) {
      break;
    }
    state.series = currentSeries;

    // 1. Get updates from the broker, to see if an order
    //    was triggered.
    //    TODO

    // 2. Get updates from the strategy, to update its
    //    order and stop loss and take profit levels.
    const mutations = strat(state);
    Object.assign(state, mutations);

    // 3. Get updates from the broker again, to apply the
    //    possible order changes decide by the strategy.
    //    TODO

  }

  // TODO: Return the results, containing the profits/losses,
  // preferably also per each trade.
}


