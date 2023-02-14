import { flatMap, pick, pipe, uniq } from "remeda";
import { backtest, BacktestAsyncArgs } from "../backtest";
import { isIntraday } from "../time";
import { OmitStrict } from "../util/type-util";
import { UniverseSet } from "./get-universe-set";
import { getIntradayUniverseCandleProvider } from "./intraday-universe-candle-provider";

export type BacktestUniverseArgs = OmitStrict<
  BacktestAsyncArgs,
  "symbols" | "from" | "to" | "batchSize" | "createCandleUpdateProvider"
> & {
  universeSet: UniverseSet;
};

/**
 * Backtests a trading strategy with the provided universe set. The backtester
 * is provided with intraday candles for the symbols that are included in the
 * universe for each day in the universe set. This means that there can be large
 * caps in the data, and the strategy should be aware of that.
 *
 * Throws if called with daily or higher timeframe.
 */
export async function backtestUniverses(args: BacktestUniverseArgs) {
  if (!isIntraday(args.timeframe)) {
    throw Error(
      "backtestUniverse requires intraday timeframe, but was " + args.timeframe
    );
  }

  // These are only reported in the result, because custom candle provider is used:
  const symbols: string[] = pipe(
    args.universeSet.universes,
    flatMap((u) => u.symbols),
    uniq()
  );

  return backtest({
    ...args,
    symbols,
    ...pick(args.universeSet, ["from", "to"]),
    createCandleUpdateProvider: getIntradayUniverseCandleProvider(
      args.universeSet
    ),
  });
}
