import { concat, dropLast, identity, map, pipe, reduce, sortBy } from "remeda";
import { BacktestResult, BacktestSyncResult } from "..";
import { last } from "../util/util";

/**
 * A time series that tracks the account equity value throughout a backtest,
 * plus related statistics (peak equity and drawdown).
 */
export interface EquityCurve {
  /**
   * Time series of account's equity and drawdown throughout a backtest.
   */
  series: EquityCurvePoint[];
  /**
   * The max value that the account's equity had during the backtest.
   */
  peak: number;
  /**
   * The max drawdown relative to the peak equity at the moment of the drawdown.
   * Always positive. E.g. 0.12 for 12% drawdown.
   */
  maxRelativeDrawdown: number;
  /**
   * The max drawdown relative to the peak equity at the moment of the drawdown.
   */
  maxAbsoluteDrawdown: number;
}

export interface EquityCurvePoint {
  time: number;
  equity: number;
  relativeDrawdown: number;
  absoluteDrawdown: number;
}

/**
 * From the given backtest result, creates a time series that tracks equity
 * (total value of cash balance and all positions) and drawdown (distance from
 * peak equity) throughout the backtest. The return value also includes the peak
 * equity value during the backtest, as well as the maximum drawdown.
 *
 * Note that the equity is updated (new point added to the time series) only at
 * each trade's exit transaction. In reality the equity changes also while in
 * position as the asset value fluctuates, but this function does not track
 * those changes.
 */
export function getEquityCurve({
  stats,
  trades,
}: BacktestResult | BacktestSyncResult): EquityCurve {
  const initialState: EquityCurve = {
    series: [],
    peak: stats.initialBalance,
    maxRelativeDrawdown: 0,
    maxAbsoluteDrawdown: 0,
  };

  if (!stats.candleTimeRange) {
    return initialState;
  }

  const firstPoint: EquityCurvePoint = {
    time: stats.candleTimeRange.from,
    equity: stats.initialBalance,
    relativeDrawdown: 0,
    absoluteDrawdown: 0,
  };

  return pipe(
    trades,
    map((trade) => ({
      time: trade.exit.time,
      absoluteProfit: trade.absoluteProfit,
    })),
    sortBy((t) => t.time),
    combineSimultaneousExits,
    reduce(addToEquityCurve, {
      ...initialState,
      series: [...initialState.series, firstPoint],
    })
  );
}

interface TimeAndProfit {
  time: number;
  absoluteProfit: number;
}

const combineSimultaneousExits = reduce<TimeAndProfit, TimeAndProfit[]>(
  (acc, { time, absoluteProfit }) => {
    const previous = last(acc);
    const overrideLast = previous && previous.time === time;

    return pipe(
      acc,
      overrideLast ? dropLast(1) : identity,
      concat([
        {
          time,
          absoluteProfit:
            absoluteProfit + (overrideLast ? previous.absoluteProfit : 0),
        },
      ])
    );
  },
  []
);

function addToEquityCurve(
  state: EquityCurve,
  { time, absoluteProfit }: { time: number; absoluteProfit: number }
): EquityCurve {
  const previous = last(state.series);

  const equity = previous.equity + absoluteProfit;
  const peak = Math.max(state.peak, equity);
  const absoluteDrawdown = peak - equity;
  // Realistically peak account value should always be positive, but in case
  // backtester decides to start from zero balance and the first trade is a
  // loss, just use zero, as it is impossible to produce a meaningful relative
  // drawdown.
  const relativeDrawdown = peak > 0 ? absoluteDrawdown / peak : 0;

  const entry: EquityCurvePoint = {
    time,
    equity,
    relativeDrawdown,
    absoluteDrawdown,
  };

  return {
    series: [...state.series, entry],
    peak,
    maxRelativeDrawdown: Math.max(state.maxRelativeDrawdown, relativeDrawdown),
    maxAbsoluteDrawdown: Math.max(state.maxAbsoluteDrawdown, absoluteDrawdown),
  };
}
