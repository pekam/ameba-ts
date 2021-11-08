//@ts-ignore cli-progress type defs are broken
import { Presets, SingleBar } from "cli-progress";
import { range } from "lodash";
import { Candle } from "./core/types";
import { getCurrentTimestampInSeconds } from "./shared/time-util";
const readline = require("readline");

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
 * Returns a URL for viewing charts from a data set.
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
  return `http://localhost:3000/dataSet?dataSetId=${dataSetId}&symbols=${chartParams}`;
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toFixed(num: number, decimals: number): number {
  return parseFloat(num.toFixed(decimals));
}

export function clearLastLine(times = 1) {
  range(times).forEach((i) => {
    readline.moveCursor(process.stdout, -999, -1); // up one line
    readline.clearLine(process.stdout, 1); // from cursor to end
  });
}

export async function restartOnError(
  run: () => Promise<any>,
  retryResetPeriod: number
) {
  let retrySleepSec = 1;
  let lastRetryTime: number | undefined;

  while (true) {
    try {
      await run();
      // Finished without error
      return;
    } catch (e) {
      console.error(e);

      if (
        !lastRetryTime ||
        getCurrentTimestampInSeconds() - lastRetryTime > retryResetPeriod
      ) {
        retrySleepSec = 1;
      } else {
        retrySleepSec = Math.min(retrySleepSec * 1.5, 60);
      }

      console.log(`Restarting after ${retrySleepSec} seconds...`);
      await sleep(retrySleepSec * 1000);

      lastRetryTime = getCurrentTimestampInSeconds();
    }
  }
}
