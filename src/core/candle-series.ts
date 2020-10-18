import { RawCandle } from "./types";
import { timestampToUTCDateString } from "./date-util";

export class Candle implements RawCandle {
  close: number;
  high: number;
  low: number;
  open: number;
  time: number;
  volume: number;

  utcDateString: string;
  relativeChange: number;

  index: number;

  constructor(rawCandles: RawCandle[], index: number) {
    const rawCandle = rawCandles[index];
    Object.getOwnPropertyNames(rawCandle).forEach(
      (propName) => (this[propName] = rawCandle[propName])
    );

    const prev = rawCandles[index - 1];
    const oldValue: number = prev ? prev.close : rawCandle.open;
    this.relativeChange = (rawCandle.close - oldValue) / oldValue;

    this.utcDateString = timestampToUTCDateString(rawCandle.time);

    this.index = index;
  }
}

export class CandleSeries extends Array<Candle> {
  /**
   * @param rawCandles in chronological order
   */
  constructor(...rawCandles: RawCandle[]) {
    super(
      ...rawCandles.map((rawCandle, index) => {
        return new Candle(rawCandles, index);
      })
    );

    // https://github.com/Microsoft/TypeScript/issues/18035
    Object.setPrototypeOf(this, CandleSeries.prototype);
  }

  slice(start?: number, end?: number): CandleSeries {
    return new CandleSeries(...super.slice(start, end));
  }

  // Needs to be implemented to avoid breaking when filter returns empty array
  filter(f) {
    const res = [];
    this.forEach((c) => {
      f(c) && res.push(c);
    });
    return new CandleSeries(...res);
  }

  /**
   * Returns a new series including only the candles
   * of this series that are in the given time range.
   *
   * @param from the lower limit as unix timestamp, inclusive
   * @param to the upper limit as unix timestamp, exclusive
   */
  subSeries(from: number, to: number): CandleSeries {
    return new CandleSeries(
      ...this.filter((candle) => candle.time >= from && candle.time < to)
    );
  }

  /**
   * Returns a TimeTraveller for this series, that can be
   * used to simulate how the data is received one candle
   * at a time.
   *
   * @param from the unix time of the last candle to
   * be included in the first iteration
   * @param to the unix time of the candle which will
   * end the iteration once encountered
   */
  getTimeTraveller(from: number, to: number): TimeTraveller {
    return new TimeTraveller(this, from, to);
  }

  /**
   * Gets the last candle in the series.
   */
  get last(): Candle {
    return this[this.length - 1];
  }

  /**
   * Gets the time range of the candles as unix timestamps.
   */
  get range(): { start: number; end: number } {
    return {
      start: this[0].time,
      end: this.last.time,
    };
  }
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
    return new CandleSeries(...this.series.slice(0, ++this.nextIndex));
  }

  /**
   * Returns true if the iteration has not finished, and the
   * next() function can still be called succesfully.
   */
  hasNext(): boolean {
    return this.nextIndex >= 0 && this.nextIndex < this.endIndex;
  }
}
