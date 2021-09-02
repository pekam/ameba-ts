import { takeRightWhile } from "lodash";
import { ADX, KeltnerChannels, MACD, RSI, SMA } from "technicalindicators";
import { m } from "../shared/functions";
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
  readonly keltnerChannelSettings?: {
    atrPeriod: number;
    maPeriod: number;
    multiplier: number;
    useSma?: boolean;
  };
}

interface IndicatorChannel {
  upper: number;
  middle: number;
  lower: number;
}

export interface IndicatorValues {
  sma?: number;
  rsi?: number;
  donchianChannel?: IndicatorChannel;
  adx?: number;
  mdi?: number;
  pdi?: number;
  macd?: MacdResult;
  keltnerChannel?: IndicatorChannel;
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
  private readonly keltnerChannel: KeltnerChannels;
  private readonly donchianChannel: DonchianChannel;

  private readonly candleToIndicators: WeakMap<
    Candle,
    IndicatorValues
  > = new WeakMap();

  private lastTimestamp = -1;

  constructor(public readonly settings: IndicatorSettings) {
    if (settings.smaPeriod) {
      this.sma = new SMA({ period: settings.smaPeriod, values: [] });
    }
    if (settings.rsiPeriod) {
      this.rsi = new RSI({ period: settings.rsiPeriod, values: [] });
    }
    if (settings.donchianChannelPeriod) {
      this.donchianChannel = getDonchianChannel(settings.donchianChannelPeriod);
    }
    if (settings.adxPeriod) {
      this.adx = new ADX({
        close: [],
        high: [],
        low: [],
        period: settings.adxPeriod,
      });
    }
    if (settings.macdSettings) {
      this.macd = new MACD({
        ...settings.macdSettings,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
        values: [],
      });
    }
    if (settings.keltnerChannelSettings) {
      this.keltnerChannel = new KeltnerChannels({
        ...settings.keltnerChannelSettings,
        high: [],
        low: [],
        close: [],
        useSMA: !!settings.keltnerChannelSettings.useSma,
      });
    }
  }

  private addIndicatorsForNextCandle(candle: Candle) {
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
      donchianChannel: this.donchianChannel && this.donchianChannel(candle),
      ...directionalIndicators,
      macd,
      keltnerChannel:
        // @ts-ignore TS defs have wrong argument type
        this.keltnerChannel && this.keltnerChannel.nextValue({ ...candle }),
    };

    this.candleToIndicators.set(candle, indicatorValues);
  }

  update(series: CandleSeries): IndicatorValues {
    takeRightWhile(series, (c) => c.time > this.lastTimestamp).forEach(
      (candle) => {
        this.addIndicatorsForNextCandle(candle);
      }
    );
    this.lastTimestamp = Math.max(this.lastTimestamp, m.last(series).time);
    return this.get(m.last(series))!;
  }

  get(candle: Candle): IndicatorValues | undefined {
    return this.candleToIndicators.get(candle);
  }
}

type DonchianChannel = (candle: Candle) => IndicatorChannel | undefined;

function getDonchianChannel(period: number): DonchianChannel {
  if (period < 1) {
    throw Error("Donchian channel period must be >=1");
  }
  const candles: Candle[] = [];

  return (candle: Candle) => {
    if (candles.length === period) {
      candles.shift();
    }
    candles.push(candle);
    if (candles.length !== period) {
      return undefined;
    }
    const upper = Math.max(...candles.map(m.high));
    const lower = Math.min(...candles.map(m.low));
    const middle = m.avg([upper, lower]);
    return { upper, lower, middle };
  };
}
