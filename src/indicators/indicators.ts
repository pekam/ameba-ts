import { takeRightWhile } from "lodash";
import { ADX, ATR, KeltnerChannels, MACD, RSI, SMA } from "technicalindicators";
import { Candle, CandleSeries } from "../core/types";
import { last } from "../util/util";
import { DonchianChannel, getDonchianChannel } from "./donchian-channel";
import { getPredicateCounter } from "./predicate-counter";

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
  readonly atrPeriod?: number;
  /**
   * Indicator that tells how many of the past N candles satisfy the given condition.
   * For example, to check how many of the past 20 candles are above the SMA:
   *
   * {
   *   predicate: (candle, { sma }) => !!sma && candle.low > sma,
   *   period: 20,
   * }
   *
   * The result is the proportion, e.g. 0.25 if 5 of the past 20 candles are above sma.
   */
  readonly predicateCounterSettings?: PredicateCounterSettings;
  readonly avgVolPeriod?: number;
  /**
   * Simple moving average of `(high-low)/low`.
   */
  readonly avgRelativeRangePeriod?: number;
}

export interface PredicateCounterSettings {
  predicate: (candle: Candle, indicatorValues: IndicatorValues) => boolean;
  period: number;
}

export interface IndicatorChannel {
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
  atr?: number;
  /**
   * The proportion of candles during the period which
   * satisfy the predicate, e.g. 0.5.
   */
  predicateCounter?: number;
  avgVol?: number;
  /**
   * Simple moving average of `(high-low)/low`.
   */
  avgRelativeRange?: number;
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
  private readonly atr: ATR;
  private readonly predicateCounterFunc: (
    candle: Candle,
    indicatorValues: IndicatorValues
  ) => number | undefined;
  private readonly avgVol: SMA;
  private readonly avgRelativeRange: SMA;

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
    if (settings.atrPeriod) {
      this.atr = new ATR({
        close: [],
        high: [],
        low: [],
        period: settings.atrPeriod,
      });
    }
    if (settings.predicateCounterSettings) {
      this.predicateCounterFunc = getPredicateCounter(
        settings.predicateCounterSettings
      );
    }
    if (settings.avgVolPeriod) {
      this.avgVol = new SMA({ period: settings.avgVolPeriod, values: [] });
    }
    if (settings.avgRelativeRangePeriod) {
      this.avgRelativeRange = new SMA({
        period: settings.avgRelativeRangePeriod,
        values: [],
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

    const indicatorValues: IndicatorValues = {
      sma: this.sma && this.sma.nextValue(candle.close),
      rsi: this.rsi && this.rsi.nextValue(candle.close),
      donchianChannel: this.donchianChannel && this.donchianChannel(candle),
      ...directionalIndicators,
      macd,
      keltnerChannel:
        // @ts-ignore TS defs have wrong argument type
        this.keltnerChannel && this.keltnerChannel.nextValue({ ...candle }),
      atr: this.atr && this.atr.nextValue(candle),
      avgVol:
        this.avgVol && candle.volume !== undefined
          ? this.avgVol.nextValue(candle.volume)
          : undefined,
      avgRelativeRange:
        this.avgRelativeRange &&
        this.avgRelativeRange.nextValue(
          (candle.high - candle.low) / candle.low
        ),
    };

    if (this.predicateCounterFunc) {
      indicatorValues.predicateCounter = this.predicateCounterFunc(
        candle,
        indicatorValues
      );
    }

    this.candleToIndicators.set(candle, indicatorValues);
  }

  update(series: CandleSeries): IndicatorValues {
    takeRightWhile(series, (c) => c.time > this.lastTimestamp).forEach(
      (candle) => {
        this.addIndicatorsForNextCandle(candle);
      }
    );
    this.lastTimestamp = Math.max(this.lastTimestamp, last(series).time);
    return this.get(last(series))!;
  }

  get(candle: Candle): IndicatorValues | undefined {
    return this.candleToIndicators.get(candle);
  }
}