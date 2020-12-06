import { ADX, RSI, SMA } from "technicalindicators";
import { CandleSeries } from "./candle-series";
import { last } from "../util";

export interface IndicatorSettings {
  readonly smaPeriod?: number;
  readonly rsiPeriod?: number;
  readonly donchianChannelPeriod?: number;
  readonly adxPeriod?: number;
}

export interface IndicatorValues {
  sma?: number;
  rsi?: number;
  donchianChannel?: { upper: number; middle: number; lower: number };
  adx?: number;
  mdi?: number;
  pdi?: number;
}

export class Indicators {
  private readonly sma: SMA;
  private readonly rsi: RSI;
  private readonly adx: ADX;

  constructor(
    public readonly settings: IndicatorSettings,
    initialSeries: CandleSeries
  ) {
    const candlesToInclude = initialSeries.slice(0, initialSeries.length - 1);
    const close = candlesToInclude.map((c) => c.close);
    const high = candlesToInclude.map((c) => c.high);
    const low = candlesToInclude.map((c) => c.low);

    if (settings.smaPeriod) {
      this.sma = new SMA({ period: this.settings.smaPeriod, values: close });
    }
    if (settings.rsiPeriod) {
      this.rsi = new RSI({ period: settings.rsiPeriod, values: close });
    }
    if (settings.adxPeriod) {
      this.adx = new ADX({ close, high, low, period: settings.adxPeriod });
    }
  }

  update(series: CandleSeries): IndicatorValues {
    const candle = last(series);

    // Result has values for adx, mdi and pdi
    const directionalIndicators = this.adx
      ? // @ts-ignore TS defs have wrong argument type
        this.adx.nextValue({ ...candle })
      : {};

    return {
      sma: this.sma && this.sma.nextValue(candle.close),
      rsi: this.rsi && this.rsi.nextValue(candle.close),
      donchianChannel:
        this.settings.donchianChannelPeriod &&
        getDonchianChannel(series, this.settings.donchianChannelPeriod),
      ...directionalIndicators,
    };
  }
}

export function getDonchianChannel(
  series: CandleSeries,
  period: number
): { upper: number; middle: number; lower: number } {
  const subseries = series.slice(-period);
  const upper = Math.max(...subseries.map((candle) => candle.high));
  const lower = Math.min(...subseries.map((candle) => candle.low));
  const middle = lower + (upper - lower) / 2;
  return { upper, lower, middle };
}
