//@ts-ignore cli-progress type defs are broken
import { Presets, SingleBar } from "cli-progress";
import { ProgressHandler } from "./backtest";

/**
 * Creates a backtest progress handler which renders a progress bar in the
 * console.
 */
export function createProgressBar(): ProgressHandler {
  const progressBar = new SingleBar({}, Presets.shades_classic);
  return {
    onStart: (iterationCount: number) => progressBar.start(iterationCount, 0),
    afterIteration: () => progressBar.increment(),
    onFinish: () => progressBar.stop(),
  };
}
