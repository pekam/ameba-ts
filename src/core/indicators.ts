import { RSI, SMA } from "technicalindicators";
import { CandleSeries } from "./candle-series";

export interface IndicatorSettings {
  readonly smaPeriod?: number;
  readonly rsiPeriod?: number;
  readonly donchianChannelPeriod?: number;
}

export interface IndicatorValues {
  sma?: number;
  rsi?: number;
  donchianChannel?: { upper: number; middle: number; lower: number };
}

export class Indicators {
  private readonly sma: SMA;
  private readonly rsi: RSI;

  constructor(
    public readonly settings: IndicatorSettings,
    initialSeries: CandleSeries
  ) {
    const closes = initialSeries
      .slice(0, initialSeries.length - 1)
      .map((c) => c.close);

    if (settings.smaPeriod) {
      this.sma = new SMA({ period: this.settings.smaPeriod, values: closes });
    }
    if (settings.rsiPeriod) {
      this.rsi = new RSI({ period: settings.rsiPeriod, values: closes });
    }
  }

  update(series: CandleSeries): IndicatorValues {
    return {
      sma: this.sma && this.sma.nextValue(series.last.close),
      rsi: this.rsi && this.rsi.nextValue(series.last.close),
      donchianChannel:
        this.settings.donchianChannelPeriod &&
        getDonchianChannel(series, this.settings.donchianChannelPeriod),
    };
  }
}

function getDonchianChannel(
  series: CandleSeries,
  period: number
): { upper: number; middle: number; lower: number } {
  const subseries = series.slice(-period);
  const upper = Math.max(...subseries.map((candle) => candle.high));
  const lower = Math.min(...subseries.map((candle) => candle.low));
  const middle = lower + (upper - lower) / 2;
  return { upper, lower, middle };
}
