import { Indicators } from "../core/indicators";
import { SizelessStrategy } from "../core/staker";
import { CandleSeries, TradeState } from "../core/types";
import { m } from "../shared/functions";
import { cancelEntry } from "./strat-util";

/**
 */
function donchianReversionStrategy(channelPeriod: number): SizelessStrategy {
  const indicators = new Indicators({
    donchianChannelPeriod: channelPeriod,
  });

  return (state: TradeState) => {
    const series = state.series;

    const { donchianChannel } = indicators.update(series);

    if (series.length < channelPeriod || !donchianChannel) {
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
        return cancelEntry;
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

      return cancelEntry;
    }
    return {};
  };
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
