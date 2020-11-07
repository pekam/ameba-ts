import { Presets, SingleBar } from "cli-progress";

/**
 * Returns the average of the provided numbers.
 */
export const avg: (values: number[]) => number = (values) =>
  sum(values) / values.length;

export const sum: (values: number[]) => number = (values) =>
  values.reduce((sum, value) => sum + value, 0);

/**
 * Applies the function to the value if the condition is true, otherwise
 * returns the value.
 */
export const applyIf = <T>(condition: boolean, func: (T) => T, value: T): T => {
  if (condition) {
    return func(value);
  } else {
    return value;
  }
};

export const startProgressBar = (length: number, enabled = true) => {
  if (!enabled) {
    return {
      increment: () => {},
      stop: () => {},
    };
  }
  const progressBar = new SingleBar({}, Presets.shades_classic);
  progressBar.start(length, 0);

  return {
    increment: () => progressBar.increment(),
    stop: () => progressBar.stop(),
  };
};
