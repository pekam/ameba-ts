import { Candle, RawCandle } from "./types";
import { timestampToUTCDateString } from "./date-util";
import { m } from "../functions/functions";

export type CandleSeries = Array<Candle>;

export function toCandleSeries(candles: RawCandle[]): CandleSeries {
  const series = candles.reduce((series, rawCandle, index) => {
    const previous = m.last(series);
    const oldValue = previous ? previous.close : rawCandle.open;

    const candle: Candle = {
      ...rawCandle,
      previous,
      utcDateString: timestampToUTCDateString(rawCandle.time),
      relativeChange: (rawCandle.close - oldValue) / oldValue,
    };
    series.push(candle);
    return series;
  }, []);

  return series;
}

/**
 * Allows iterating over a CandleSeries, by expanding a
 * subseries with one more candle, each time when calling
 * the next() function.
 *
 * This can be used by the backtesting system, to simulate
 * going through the history one candle at a time.
 */
export class TimeTraveller {
  private readonly series: CandleSeries;
  /**
   * Index of the candle that will be the last one included
   * in the next call of next() function.
   */
  private nextIndex: number;
  /**
   * Index of the first candle not included, based on the
   * given endTime (if provided).
   */
  private endIndex: number;
  /**
   * The number of candles in the full time period.
   */
  length: number;

  constructor(series: CandleSeries, from: number, to: number) {
    this.series = series;

    if (from) {
      this.nextIndex = series.findIndex((candle) => candle.time === from);
    } else {
      // Default to 1 instead of 0 so that indicators can be initialized
      this.nextIndex = 1;
    }

    if (to) {
      this.endIndex = series.findIndex((candle) => candle.time === to);
    } else {
      this.endIndex = series.length;
    }

    if (this.nextIndex < 0) {
      throw new Error(
        "Failed to create TimeTraveller. " +
          "Could not find a candle with startTime " +
          from
      );
    }
    if (this.endIndex < 0) {
      throw new Error(
        "Failed to create TimeTraveller. " +
          "Could not find a candle with endTime " +
          to
      );
    }
    this.length = this.endIndex - this.nextIndex;
  }

  /**
   * Returns the next subseries, including one more candle
   * compared to the previous call of this function.
   */
  next(): CandleSeries {
    if (!this.hasNext()) {
      throw new Error("TimeTraveller index out of bounds.");
    }
    return this.series.slice(0, ++this.nextIndex);
  }

  /**
   * Returns true if the iteration has not finished, and the
   * next() function can still be called succesfully.
   */
  hasNext(): boolean {
    return this.nextIndex >= 0 && this.nextIndex < this.endIndex;
  }
}
