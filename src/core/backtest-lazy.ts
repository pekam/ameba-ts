import { filter, mapToObj, pipe } from "remeda";
import { toTimestamp } from "../util/time-util";
import { Nullable, OverrideProps } from "../util/type-util";
import {
  BacktestArgs,
  InternalTradeState,
  produceNextState,
  revertUnclosedTrades,
} from "./backtest";
import { BacktestResult, convertToBacktestResult } from "./backtest-result";
import { CandleUpdate } from "./create-candle-updates";
import { createProgressBar } from "./progress-bar";
import { AssetMap, Range } from "./types";

export type LazyCandleProvider = (
  lastCandleTime: number | undefined
) => Promise<Nullable<CandleUpdate>>;

export interface BacktestLazyArgs
  extends Omit<BacktestArgs, "series" | "progressHandler"> {
  /**
   * A function that should return the next set of candles for the backtester
   * each time when called. All candles which have the same timestamp (one per
   * asset) should be included in the same return value. Each return value
   * should include newer candles than the previous one.
   *
   * The function should return null or undefined when the backtest should
   * finish. The backtest can also end if the optional 'to'-parameter is
   * provided and this moment is reached.
   *
   * The return value is a Promise, so the implementation can for example fetch
   * a batch of data from a web service or a database when needed, and there's
   * no need to keep old data in memory.
   */
  candleProvider: LazyCandleProvider;
}

type AdjustedBacktestLazyArgs = OverrideProps<
  Required<BacktestLazyArgs>,
  { from: number; to: number }
>;

/**
 * Tests how the given trading strategy would have performed with the historical
 * price data that is requested on demand from the given candle provider
 * function.
 */
export async function backtestLazy(
  args: BacktestLazyArgs
): Promise<BacktestResult> {
  return doBacktestLazy(adjustArgs(args));
}

function adjustArgs(args: BacktestLazyArgs): AdjustedBacktestLazyArgs {
  const withDefaults = {
    initialBalance: 10000,
    commissionProvider: () => 0,
    progressHandler: createProgressBar(),
    from: 0,
    to: Infinity,
    ...args,
  };
  return {
    ...withDefaults,
    // Enforce timestamps as numbers:
    from: toTimestamp(withDefaults.from),
    to: toTimestamp(withDefaults.to),
  };
}

async function doBacktestLazy(
  args: AdjustedBacktestLazyArgs
): Promise<BacktestResult> {
  let state = createInitialState(args);
  let lastCandleTime: number | undefined = undefined;
  let backtestRange: Partial<Range> = {};

  while (true) {
    const candleUpdate: Nullable<CandleUpdate> = await args.candleProvider(
      lastCandleTime
    );

    if (!candleUpdate || candleUpdate.time > args.to) {
      break;
    }

    if (candleUpdate.time >= args.from) {
      state = pipe(state, initMissingAssetStates(candleUpdate), (state) =>
        produceNextState(state, candleUpdate)
      );
      backtestRange = {
        from: backtestRange.from || candleUpdate.time,
        to: candleUpdate.time,
      };
    }
    lastCandleTime = candleUpdate.time;
  }

  // Only finished trades are included in the result. Another option would be to
  // close all open trades with the current market price, but exiting against
  // the strategy's logic would skew the result.
  return convertToBacktestResult(revertUnclosedTrades(state), {
    from: backtestRange.from!, // TODO handle zero candle updates properly
    to: backtestRange.to!,
  });
}

const initMissingAssetStates =
  (candleUpdate: CandleUpdate) =>
  (state: InternalTradeState): InternalTradeState => {
    const symbols = candleUpdate.nextCandles.map(({ symbol }) => symbol);
    const newAssets: AssetMap = pipe(
      symbols,
      filter((symbol) => !state.assets[symbol]),
      mapToObj((symbol) => [
        symbol,
        {
          symbol,
          series: [],
          position: null,
          entryOrder: null,
          takeProfit: null,
          stopLoss: null,
          transactions: [],
          trades: [],
          data: {},
        },
      ])
    );
    return {
      ...state,
      assets: { ...state.assets, ...newAssets },
    };
  };

function createInitialState(
  args: AdjustedBacktestLazyArgs
): InternalTradeState {
  return {
    cash: args.initialBalance,
    assets: {},
    updated: [],
    time: 0,
    args,
  };
}
