import { Presets, SingleBar } from "cli-progress";
import { Candle } from "./core/types";

export function last<T>(array: Array<T>) {
  return array[array.length - 1];
}

/**
 * Returns the average of the provided numbers.
 */
export const avg: (values: number[]) => number = (values) =>
  sum(values) / values.length;

export const sum: (values: number[]) => number = (values) =>
  values.reduce((sum, value) => sum + value, 0);

export const range: (length: number) => number[] = (length) =>
  Array.from(Array(length).keys());

export function sortDescending<T>(
  items: T[],
  sortBy: (item: T) => number
): T[] {
  return items.slice().sort((a, b) => sortBy(b) - sortBy(a));
}

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

/**
 * Returns a URL for viewing charts.
 *
 * @param dataSetId the name of the data set from which to load the candle data
 * @param chartData for each chart, contains info of the symbol whose candles to
 * load, and candles which to mark in the chart with an arrow, either above or
 * below the candlestick.
 */
export function getUrl(
  dataSetId: string,
  chartData: {
    symbol: string;
    markersAbove: Candle[];
    markersBelow: Candle[];
  }[]
) {
  const chartParams = chartData.map(
    ({ symbol, markersAbove, markersBelow }) => {
      const markersAboveString = markersAbove
        .map((candle) => "_" + candle.time)
        .join("");
      const markersBelowString = markersBelow
        .map((candle) => "_b" + candle.time)
        .join("");

      return symbol + markersAboveString + markersBelowString;
    }
  );
  return `http://localhost:3000/?dataSet=${dataSetId}&symbols=${chartParams}`;
}
