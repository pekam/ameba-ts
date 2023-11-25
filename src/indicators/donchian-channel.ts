import { maxBy, minBy } from "remeda";
import { Candle } from "../core/types";
import { avg } from "../util/util";
import { IndicatorChannel, createIndicatorWithPeriod } from "./indicator-util";

/**
 * Returns the value of a Donchian channel indicator.
 */
export const getDonchianChannel = createIndicatorWithPeriod<IndicatorChannel>(
  "donchianChannel",
  initDonchianChannel
);

function initDonchianChannel(period: number) {
  if (period < 1) {
    throw Error("Donchian channel period must be >=1");
  }
  const candles: Candle[] = [];

  let maxCandle: Candle | undefined;
  let minCandle: Candle | undefined;

  return (candle: Candle) => {
    candles.push(candle);

    const removed = candles.length > period && candles.shift();

    if (candles.length !== period) {
      return undefined;
    }

    if (!maxCandle || removed === maxCandle) {
      maxCandle = maxBy(candles, (c) => c.high)!;
    } else if (candle.high > maxCandle.high) {
      maxCandle = candle;
    }

    if (!minCandle || removed === minCandle) {
      minCandle = minBy(candles, (c) => c.low)!;
    } else if (candle.low < minCandle.low) {
      minCandle = candle;
    }

    const upper = maxCandle.high;
    const lower = minCandle.low;
    const middle = avg([upper, lower]);
    return { upper, lower, middle };
  };
}
