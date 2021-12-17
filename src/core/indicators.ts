import { maxBy, minBy, takeRightWhile } from "lodash";
import { ADX, ATR, KeltnerChannels, MACD, RSI, SMA } from "technicalindicators";
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
  readonly atrPeriod?: number;
  /**
   * Indicator that tells how many of the past N candles satisfy the given condition.
   * For example, to check how many of the past 20 candles are above the SMA:
   *
   * {
   *   predicate: (candle, { sma }) => !!sma && candles.low > sma,
   *   period: 20,
   * }
   *
   * The result is the proportion, e.g. 0.25 if 5 of the past 20 candles are above sma.
   */
  readonly predicateCounterSettings?: {
    predicate: (candle: Candle, indicatorValues: IndicatorValues) => boolean;
    period: number;
  };
  readonly avgVolPeriod?: number;
  /**
   * Simple moving average of `(high-low)/low`.
   */
  readonly avgRelativeRangePeriod?: number;
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
    condition: boolean
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
        settings.predicateCounterSettings.period
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
      const predicateCounter = this.predicateCounterFunc(
        this.settings.predicateCounterSettings!.predicate(
          candle,
          indicatorValues
        )
      );
      indicatorValues.predicateCounter = predicateCounter;
    }

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

  let maxCandle: Candle | undefined;
  let minCandle: Candle | undefined;

  return (candle: Candle) => {
    candles.push(candle);

    const removed = candles.length > period && candles.shift();

    if (candles.length !== period) {
      return undefined;
    }

    if (!maxCandle || removed === maxCandle) {
      maxCandle = maxBy(candles, (c) => c.high)!;
    } else if (candle.high > maxCandle.high) {
      maxCandle = candle;
    }

    if (!minCandle || removed === minCandle) {
      minCandle = minBy(candles, (c) => c.low)!;
    } else if (candle.low < minCandle.low) {
      minCandle = candle;
    }

    const upper = maxCandle.high;
    const lower = minCandle.low;
    const middle = m.avg([upper, lower]);
    return { upper, lower, middle };
  };
}

function getPredicateCounter(period: number) {
  if (period < 1) {
    throw Error("Period must be >=1");
  }
  const results: boolean[] = [];
  let counter = 0;

  return (result: boolean) => {
    results.push(result);
    if (result) {
      counter++;
    }
    if (results.length > period) {
      const removed = results.shift();
      if (removed) {
        counter--;
      }
    }
    if (results.length !== period) {
      return undefined;
    }
    return counter / period;
  };
}
