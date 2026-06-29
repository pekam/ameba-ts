import { flatMap, pipe, sortBy, values } from "remeda";
import { Trade } from "../core/types";
import { Timeframe, toTimestamp } from "../time";
import { OverrideProps } from "../util/type-util";
import { BacktestAsyncArgs, BacktestState } from "./backtest";
import { revertLastTransaction } from "./backtest-order-execution";
import { updateAsset } from "./update-asset";

export interface BacktestStatistics {
  initialBalance: number;
  endBalance: number;
  /**
   * The change of account balance relative to the initial balance.
   *
   * For example: -0.5 for a 50% loss, or 1.2 for a 120% profit.
   */
  relativeProfit: number;
  /**
   * Number of trades executed during the backtest.
   */
  tradeCount: number;
  /**
   * Number of profitable trades relative to all trades.
   *
   * For example: 0.4 if there were 4 wins and 6 losses (or breakeven trades).
   */
  winRate: number;
  /**
   * Information about the data used in the backtest. Contains everything needed
   * to load the same set of data as used by the backtest.
   */
  dataInfo: {
    /**
     * Name of the data provider that was used to fetch data for the backtest.
     */
    dataProviderName: string;
    /**
     * Symbols of the assets included in the backtest. This is based on the
     * backtest arguments, so a symbol is included here even if no candles were
     * provided for that asset in the backtest.
     */
    symbols: string[];
    /**
     * Timeframe of the data used in the backtest (from backtest arguments).
     */
    timeframe: Timeframe;
    /**
     * Backtest data was requested from the data provider starting from this
     * timestamp.
     */
    from: number;
    /**
     * Backtest data was requested from the data provider up to this timestamp.
     */
    to: number;
  };
}

export interface BacktestResult {
  /**
   * All the trades that the strategy executed during the backtest in
   * chronological order.
   */
  trades: Trade[];
  /**
   * Performance metrics and related information about the backtest.
   */
  stats: BacktestStatistics;
}

export type BacktestSyncStatistics = Omit<BacktestStatistics, "dataInfo">;

export type BacktestSyncResult = OverrideProps<
  BacktestResult,
  { stats: BacktestSyncStatistics }
>;

export const convertToBacktestResult =
  (args: BacktestAsyncArgs) =>
  (finalState: BacktestState): BacktestResult => {
    const result = convertToBacktestSyncResult(finalState);
    const stats: BacktestStatistics = {
      ...result.stats,
      dataInfo: {
        timeframe: args.timeframe,
        symbols: args.symbols,
        dataProviderName: args.dataProvider.name,
        from: toTimestamp(args.from),
        to: toTimestamp(args.to),
      },
    };
    return { ...result, stats };
  };

export const convertToBacktestSyncResult = (
  finalState: BacktestState
): BacktestSyncResult => {
  // Only finished trades are included in the result. Another option would be to
  // close all open trades with the current market price, but exiting against
  // the strategy's logic would be skew the result in a worse way.
  return pipe(finalState, revertUnclosedTrades, (finalState) => {
    const initialBalance = finalState.initialBalance;
    const trades = getTradesInOrder(finalState);

    const endBalance = finalState.cash;

    return {
      trades,
      stats: {
        initialBalance,
        endBalance,
        relativeProfit: (endBalance - initialBalance) / initialBalance,
        tradeCount: trades.length,
        winRate:
          trades.filter((t) => t.absoluteProfit > 0).length / trades.length,
      },
    };
  });
};

function revertUnclosedTrades(state: BacktestState) {
  return Object.values(state.assets)
    .filter((a) => a.position)
    .reduce((state, asset) => {
      const { asset: nextAssetState, cash } = revertLastTransaction({
        asset,
        cash: state.cash,
      });

      return updateAsset(state, asset.symbol, nextAssetState, cash);
    }, state);
}

function getTradesInOrder(state: BacktestState) {
  return pipe(
    state.assets,
    values,
    flatMap((asset) => asset.trades),
    sortBy((trade) => trade.entry.time)
  );
}
