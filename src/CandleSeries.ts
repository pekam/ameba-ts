import { Candle } from "./loadData";

export class CandleSeries extends Array<Candle> {

  /**
   * @param candles in chronological order
   */
  constructor(...candles: Candle[]) {
    super(...candles);

    // https://github.com/Microsoft/TypeScript/issues/18035
    Object.setPrototypeOf(this, CandleSeries.prototype);
  }

  /**
   * Returns a new series including only the candles
   * of this series that are in the given time range.
   * 
   * @param from the lower limit as unix timestamp, inclusive
   * @param to the upper limit as unix timestamp, exclusive
   */
  subSeries(from: number, to: number): CandleSeries {
    return new CandleSeries(...this.filter(candle =>
      candle.time.getTime() >= from && candle.time.getTime() < to));
  }

  /**
   * Returns a TimeTraveller for this series, that can be
   * used to simulate how the data is received one candle
   * at a time.
   * 
   * @param startTime the unix time of the last candle to
   * be included in the first iteration
   */
  getTimeTraveller(startTime: number): TimeTraveller {
    return new TimeTraveller(this, startTime);
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
  get range(): { start: number, end: number } {
    const dateRange = this.rangeAsDates;
    return {
      start: dateRange.start.getTime(),
      end: dateRange.end.getTime()
    }
  }

  /**
   * Gets the time range of the candles as Date objects.
   */
  get rangeAsDates(): { start: Date, end: Date } {
    return {
      start: this[0].time,
      end: this[this.length - 1].time
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

  constructor(series: CandleSeries, startTime: number) {
    this.series = series;
    this.nextIndex = series.findIndex(candle =>
      candle.time.getTime() === startTime);
    if (this.nextIndex < 0) {
      throw new Error('Failed to create TimeTraveller. ' +
        'Could not find a candle with startTime ' + startTime);
    }
  }

  /**
   * Returns the next subseries, including one more candle
   * compared to the previous call of this function.
   */
  next(): CandleSeries {
    if (!this.hasNext()) {
      throw new Error('TimeTraveller index out of bounds.');
    }
    return new CandleSeries(...this.series.slice(0, ++this.nextIndex));
  }

  /**
   * Returns true if the iteration has not finished, and the
   * next() function can still be called succesfully.
   */
  hasNext(): boolean {
    return this.nextIndex >= 0 && this.nextIndex < this.series.length;
  }

}
