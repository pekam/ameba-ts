import { Nullable } from "../util/type-util";
import { CandleUpdate } from "./create-candle-updates";

/**
 * Called on each iteration of the backtester to provides the next set of
 * candles (max one per symbol, each with the same timestamp).
 */
export type SyncCandleUpdateProvider = (
  lastCandleTime: number | undefined
) => Nullable<CandleUpdate>;

export function createSyncCandleProvider(
  candleUpdates: CandleUpdate[]
): SyncCandleUpdateProvider {
  // Stateful for performance. The correctness of this helper value is still
  // verified each time, so the function works correctly even if it gets out of
  // sync with the backtest process (for example, if the bactest execution is
  // resumed by using a persisted backtest state).
  let candleIndex = 0;

  return (lastCandleTime: number | undefined) => {
    if (!lastCandleTime) {
      candleIndex = 0;
    } else {
      const isCorrect = candleUpdates[candleIndex - 1]?.time === lastCandleTime;
      if (!isCorrect) {
        candleIndex = candleUpdates.findIndex(
          (update) => update.time > lastCandleTime
        );
      }
    }
    return candleUpdates[candleIndex++];
  };
}
