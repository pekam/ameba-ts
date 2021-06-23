import { ADX, MACD, RSI, SMA } from "technicalindicators";
import { m } from "../functions/functions";
import { Candle, CandleSeries } from "./types";

export interface IndicatorSettings {
  readonly smaPeriod?: number;
  readonly rsiPeriod?: number;
  readonly donchianChannelPeriod?: number;
  readonly adxPeriod?: number;
  readonly macdSettings?: {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
  };
}

export interface IndicatorValues {
  sma?: number;
  rsi?: number;
  donchianChannel?: { upper: number; middle: number; lower: number };
  adx?: number;
  mdi?: number;
  pdi?: number;
  macd?: MacdResult;
}

export interface MacdResult {
  macd: number;
  signal: number;
  histogram: number;
}

export class Indicators {
  private readonly sma: SMA;
  private readonly rsi: RSI;
  private readonly adx: ADX;
  private readonly macd: MACD;

  private readonly candleToIndicators: WeakMap<
    Candle,
    IndicatorValues
  > = new WeakMap();

  constructor(
    public readonly settings: IndicatorSettings,
    initialSeries: CandleSeries
  ) {
    const candlesToInclude = initialSeries.slice(0, initialSeries.length - 1);
    const close = candlesToInclude.map(m.close);
    const high = candlesToInclude.map(m.high);
    const low = candlesToInclude.map(m.low);

    if (settings.smaPeriod) {
      this.sma = new SMA({ period: settings.smaPeriod, values: close });
    }
    if (settings.rsiPeriod) {
      this.rsi = new RSI({ period: settings.rsiPeriod, values: close });
    }
    if (settings.adxPeriod) {
      this.adx = new ADX({ close, high, low, period: settings.adxPeriod });
    }
    if (settings.macdSettings) {
      this.macd = new MACD({
        ...settings.macdSettings,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
        values: close,
      });
    }
  }

  update(series: CandleSeries): IndicatorValues {
    const candle = m.last(series);

    // Result has values for adx, mdi and pdi
    const directionalIndicators = this.adx
      ? // @ts-ignore TS defs have wrong argument type
        this.adx.nextValue({ ...candle })
      : {};

    const macd = (() => {
      const result = this.macd && this.macd.nextValue(candle.close);
      if (
        result === undefined ||
        result.MACD === undefined ||
        result.signal === undefined ||
        result.histogram === undefined
      ) {
        return undefined;
      }
      return {
        histogram: result.histogram,
        signal: result.signal,
        macd: result.MACD,
      };
    })();

    const indicatorValues = {
      sma: this.sma && this.sma.nextValue(candle.close),
      rsi: this.rsi && this.rsi.nextValue(candle.close),
      donchianChannel: this.settings.donchianChannelPeriod
        ? getDonchianChannel(series, this.settings.donchianChannelPeriod)
        : undefined,
      ...directionalIndicators,
      macd,
    };

    this.candleToIndicators.set(candle, indicatorValues);

    return indicatorValues;
  }

  get(candle: Candle): IndicatorValues | undefined {
    return this.candleToIndicators.get(candle);
  }
}

export function getDonchianChannel(
  series: CandleSeries,
  period: number
): { upper: number; middle: number; lower: number } {
  const subseries = series.slice(-period);
  const upper = Math.max(...subseries.map(m.high));
  const lower = Math.min(...subseries.map(m.low));
  const middle = lower + (upper - lower) / 2;
  return { upper, lower, middle };
}
