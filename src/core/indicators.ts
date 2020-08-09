import { Candle } from "./candle-series";
import { RSI, SMA } from "technicalindicators";

export class Indicators {
  private readonly candle: Candle;
  private readonly cache: any;

  constructor(candle: Candle) {
    this.candle = candle;
    this.cache = {};
  }

  /**
   * Simple moving average.
   */
  sma(period: number): number {
    const key = "sma" + period;
    const isCached = Object.getOwnPropertyNames(this.cache).includes(key);
    if (!isCached) {
      const candlesToInclude = this.candle.series.slice(
        Math.max(this.candle.index - period, 0),
        this.candle.index + 1
      );
      const smaValues = SMA.calculate({
        period,
        values: candlesToInclude.map((c) => c.close),
      });
      this.cache[key] = smaValues[smaValues.length - 1];
    }
    return this.cache[key];
  }

  /**
   * Relative strength index.
   *
   * Note: Usually only the first RSI value is calculated in isolation, and the
   * following ones are based on the previous values. Here each value is calculated
   * in isolation, so the values are not exactly the same as in e.g. charting tools.
   */
  rsi(period: number): number {
    const key = "rsi" + period;
    const isCached = Object.getOwnPropertyNames(this.cache).includes(key);
    if (!isCached) {
      const candlesToInclude = this.candle.series.slice(
        Math.max(this.candle.index - period, 0),
        this.candle.index + 1
      );
      const rsiValues = RSI.calculate({
        period,
        values: candlesToInclude.map((c) => c.close),
      });
      this.cache[key] = rsiValues[rsiValues.length - 1];
    }
    return this.cache[key];
  }
}
