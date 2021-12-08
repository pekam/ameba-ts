import { flatMap, sortBy } from "lodash";
import { m } from "../shared/functions";
import { InternalTradeState } from "./backtest-multiple";
import { CandleSeries, Range, Trade } from "./types";

export interface BacktestStatistics {
  initialBalance: number;
  endBalance: number;
  /**
   * The change of account balance relative to the initial balance.
   */
  relativeProfit: number;
  tradeCount: number;
  successRate: number;
  /**
   * How much was the relative value change during the series
   */
  buyAndHoldProfit: number;
  /**
   * Timestamps of the first and last candle included in the backtest
   * (both inclusive)
   */
  range: Range;
}

export interface BacktestResult {
  trades: Trade[];
  stats: BacktestStatistics;
}

export function convertToBacktestResult(
  finalState: InternalTradeState
): BacktestResult {
  const {
    range: { from, to },
    cash: endBalance,
  } = finalState;
  const initialBalance = finalState.args.initialBalance;
  const trades = getTradesInOrder(finalState);

  if (!from || !to) {
    throw Error("There were no candles to backtest with.");
  }
  const range = { from, to };

  const stats: BacktestStatistics = {
    initialBalance,
    endBalance,
    relativeProfit: (endBalance - initialBalance) / initialBalance,
    tradeCount: trades.length,
    successRate:
      trades.filter((t) => t.absoluteProfit > 0).length / trades.length,
    buyAndHoldProfit: getBuyAndHoldProfit(
      Object.values(finalState.args.series),
      range
    ),
    range,
  };
  return { trades, stats };
}

function getTradesInOrder(state: InternalTradeState) {
  return sortBy(
    flatMap(state.assets, (a) => a.trades),
    (t) => t.entry.time
  );
}

function getBuyAndHoldProfit(serieses: CandleSeries[], range: Range): number {
  const profitsAndDurations: [number, number][] = serieses.map((series) => {
    if (!series.length) {
      return [0, 0];
    }
    const startCandle = series.find((c) => c.time >= range.from);
    if (!startCandle) {
      return [0, 0];
    }
    const endCandle = series.find((c) => c.time >= range.to) || m.last(series);
    const startPrice = startCandle.open;
    const endPrice = endCandle.close;

    const profit = (endPrice - startPrice) / startPrice;
    const duration = endCandle.time - startCandle.time;

    return [profit, duration];
  });

  const totalWeight = m.sum(
    profitsAndDurations.map(([profit, duration]) => duration)
  );
  const weightedAvg = m.sum(
    profitsAndDurations.map(
      ([profit, duration]) => (profit * duration) / totalWeight
    )
  );

  return weightedAvg;
}
