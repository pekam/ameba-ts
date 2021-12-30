import { maxBy, minBy } from "lodash";
import { Candle } from "../core/types";
import { avg } from "../util/util";
import { IndicatorChannel } from "./indicators";

export type DonchianChannel = (candle: Candle) => IndicatorChannel | undefined;

/**
 * Returns a function that is expected to be called with candles of a series in
 * order and without gaps. It returns the indicator value the provided candle.
 *
 * The implementation is stateful for performance.
 */
export function getDonchianChannel(period: number): DonchianChannel {
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
