import { toDateString } from "../shared/time-util";
import { CandleSeries, Range } from "./types";

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
  private subseries: CandleSeries;
  /**
   * Index of the candle that will be the last one included
   * in the next call of next() function.
   */
  private nextIndex: number;
  /**
   * Index of the last candle of the subseries used in the first
   * backtest iteration.
   */
  private readonly startIndex: number;
  /**
   * Index of the first candle not included, based on the
   * given endTime (if provided).
   */
  private readonly endIndex: number;
  /**
   * The number of candles in the full time period.
   */
  readonly length: number;
  /**
   * Timestamps of the first and last candle (both inclusive).
   */
  readonly range: Range;

  constructor(series: CandleSeries, from?: number, to?: number) {
    this.series = series;

    if (from) {
      this.startIndex = series.findIndex((candle) => candle.time >= from);
    } else {
      // Default to 1 instead of 0 so that indicators can be initialized
      this.startIndex = 1;
    }
    this.nextIndex = this.startIndex;
    this.subseries = series.slice(0, this.nextIndex);

    if (to) {
      this.endIndex = series.findIndex((candle) => candle.time === to);
    } else {
      this.endIndex = series.length;
    }

    if (this.nextIndex < 0) {
      throw new Error(
        "Failed to create TimeTraveller. " +
          "Could not find a candle with startTime " +
          from +
          " " +
          toDateString(from!)
      );
    }
    if (this.endIndex < 0) {
      throw new Error(
        "Failed to create TimeTraveller. " +
          "Could not find a candle with endTime " +
          to +
          " " +
          toDateString(to!)
      );
    }
    this.length = this.endIndex - this.startIndex;
    this.range = {
      from: this.series[this.startIndex].time,
      to: this.series[this.endIndex - 1].time,
    };
  }

  /**
   * Returns the next subseries, including one more candle
   * compared to the previous call of this function.
   */
  next(): CandleSeries {
    if (!this.hasNext()) {
      throw new Error("TimeTraveller index out of bounds.");
    }
    // Need to mutate a single array instead of using slice(), because slice()
    // has O(N) performance which is a real issue when backtesting big datasets.
    this.subseries.push(this.series[this.nextIndex]);
    this.nextIndex++;
    return this.subseries;
  }

  /**
   * Returns true if the iteration has not finished, and the
   * next() function can still be called succesfully.
   */
  hasNext(): boolean {
    return this.nextIndex >= 0 && this.nextIndex < this.endIndex;
  }
}
