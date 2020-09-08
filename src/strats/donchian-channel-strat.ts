import { Order, Strategy, TradeState } from "../core/types";
import { CandleSeries } from "../core/candle-series";
import { getAverageCandleSize } from "./series-util";
import { RSI, SMA } from "technicalindicators";

const channelPeriod = 30;

class Indicators {
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

  update(
    series: CandleSeries
  ): {
    sma?: number;
    rsi?: number;
    donchianChannel?: { upper: number; middle: number; lower: number };
  } {
    return {
      sma: this.sma && this.sma.nextValue(series.last.close),
      rsi: this.rsi && this.rsi.nextValue(series.last.close),
      donchianChannel:
        this.settings.donchianChannelPeriod &&
        getDonchianChannel(series, this.settings.donchianChannelPeriod),
    };
  }
}

interface IndicatorSettings {
  readonly smaPeriod?: number;
  readonly rsiPeriod?: number;
  readonly donchianChannelPeriod?: number;
}

/**
 * Buy when making new high on the upper Donchian channel.
 *
 * Sell when crossing SMA 20.
 */
export class DonchianChannelStrategy implements Strategy {
  private indicators: Indicators;

  init(state: TradeState): void {
    this.indicators = new Indicators(
      { smaPeriod: 20, donchianChannelPeriod: channelPeriod },
      state.series
    );
  }

  update(
    state: TradeState
  ): { entryOrder?: Order; stopLoss?: number; takeProfit?: number } {
    const series = state.series;

    const { sma, donchianChannel } = this.indicators.update(series);

    if (series.length < channelPeriod) {
      return {};
    }

    if (!state.position) {
      return {
        entryOrder: {
          price:
            donchianChannel.upper +
            getAverageCandleSize(series, channelPeriod) / 5,
          type: "stop",
        },
        stopLoss: sma,
      };
    } else {
      return { stopLoss: sma };
    }
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
