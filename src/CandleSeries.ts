import { Candle } from "./loadData";

export class CandleSeries extends Array<Candle> {

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

}
