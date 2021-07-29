import { Indicators } from "../core/indicators";
import {
  CandleSeries,
  Strategy,
  StrategyUpdate,
  TradeState,
} from "../core/types";
import { m } from "../shared/functions";

/**
 */
export class DonchianReversionStrategy implements Strategy {
  private indicators: Indicators;

  constructor(private channelPeriod: number) {}

  init(state: TradeState): void {
    this.indicators = new Indicators(
      { donchianChannelPeriod: this.channelPeriod },
      state.series
    );
  }

  update(state: TradeState): StrategyUpdate {
    const series = state.series;

    const { donchianChannel } = this.indicators.update(series);

    if (series.length < this.channelPeriod || !donchianChannel) {
      return {};
    }
    const { lower, upper, middle } = donchianChannel;
    const currentPrice = m.last(series).close;

    if (!state.position) {
      const channelSize = m.getRelativeDiff(lower, upper);

      // if (channelSize < 0.02) {
      //   return {
      //     entryOrder: null,
      //   };
      // }

      if (howManyTimesHasCrossed(series.slice(-50), middle) < 5) {
        return { entryOrder: null };
      }

      const recentCandles = series.slice(-20);
      const lastSwingHighCandle = m.last(m.getSwingHighs(recentCandles));
      const lastSwingLowCandle = m.last(m.getSwingLows(recentCandles));
      if (!lastSwingHighCandle || !lastSwingLowCandle) {
        return {
          entryOrder: null,
        };
      }
      const lastSwingHigh = lastSwingHighCandle.high;
      const lastSwingLow = lastSwingLowCandle.low;

      if (
        lastSwingHigh < middle &&
        m.getRelativeDiff(lastSwingHigh, middle) > 0.01
      ) {
        return {
          entryOrder: {
            price: lastSwingHigh,
            side: "buy",
            type: "stop",
          },
          stopLoss: lastSwingLow,
          takeProfit: middle,
        };
      }

      if (
        lastSwingLow > middle &&
        m.getRelativeDiff(lastSwingLow, middle) > 0.01
      ) {
        return {
          entryOrder: {
            price: lastSwingLow,
            side: "sell",
            type: "stop",
          },
          stopLoss: lastSwingHigh,
          takeProfit: middle,
        };
      }

      return { entryOrder: null };
    }
    return {};
  }
}

function howManyTimesHasCrossed(series: CandleSeries, valueToCross: number) {
  return series.reduce((count, candle, index) => {
    if (index === 0) {
      return count;
    }
    const previous = series[index - 1];
    const previousAbove = previous.close > valueToCross;
    const candleAbove = candle.close > valueToCross;
    if (previousAbove !== candleAbove) {
      return count + 1;
    }
    return count;
  }, 0);
}
