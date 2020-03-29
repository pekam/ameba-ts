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
