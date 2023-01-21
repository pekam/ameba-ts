//@ts-ignore cli-progress type defs are broken
import { Presets, SingleBar } from "cli-progress";

/**
 * A callback that is called during backtest execution, enabling
 * reporting/visualizing the backtest's progress.
 *
 * @param currentTime the timestamp of the currently processed candle
 * @param startTime the timestamp of the first candle included in the backtest
 * @param finishTime the expected timestamp of the last candle to be included in
 * the backtest. For synchronous backtest the values is always defined and
 * correct. For async backtest the finishTime is based on the end time ('to')
 * provided by the backtest caller, and may be incorrect if the candle provider
 * stops sending candles before reaching 'to'.
 */
export type ProgressHandler = (
  currentTime: number,
  startTime: number,
  finishTime?: number
) => void;

/**
 * Creates a backtest progress handler which renders a progress bar in the
 * console.
 */
export function createProgressBar(): ProgressHandler {
  let progressBar: SingleBar;
  return (currentTime, startTime, finishTime) => {
    if (!finishTime) {
      return;
    }
    if (!progressBar) {
      progressBar = new SingleBar({}, Presets.shades_classic);
      progressBar.start(finishTime - startTime);
    }
    progressBar.update(currentTime - startTime);

    if (currentTime >= finishTime) {
      progressBar.stop();
    }
  };
}
