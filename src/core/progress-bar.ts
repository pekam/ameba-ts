//@ts-ignore cli-progress type defs are broken
import { Presets, SingleBar } from "cli-progress";
import { ProgressHandler } from "./backtest";

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
