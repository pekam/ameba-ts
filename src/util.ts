//@ts-ignore cli-progress type defs are broken
import { Presets, SingleBar } from "cli-progress";
import { Candle } from "./core/types";

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

export const getCurrentTimestampInSeconds = () =>
  Math.round(Date.now() * 0.001);

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toFixed(num: number, decimals: number): number {
  return parseFloat(num.toFixed(decimals));
}
