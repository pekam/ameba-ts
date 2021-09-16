import { flatMap } from "lodash";
import { Indicators } from "../core/indicators";
import { CandleSeries, Range } from "../core/types";
import { MARKET_CAPS } from "../data/load-company-profiles";
import { stockDataStore } from "../data/stock-data-store";
import { m } from "../shared/functions";
import { Moment, PERIODS, toStartOfDay } from "../shared/time-util";

type Signaler = (series: CandleSeries) => boolean;

interface State {
  symbol: string;
  series: CandleSeries;
  nextIndex: number;
  signaler: Signaler;
}

function getNextTimestamp(state: State): number | undefined {
  return state.series[state.nextIndex] && state.series[state.nextIndex].time;
}

type DailySignals = {
  time: number;
  stocks: {
    symbol: string;
    index: number;
    series: CandleSeries;
  }[];
}[];

/**
 * Returns an array with an entry for each day when there was at least one signal.
 * Each entry contains the list of stocks which signaled on that day.
 *
 * The profit statistics after N days of the signal occured can be calculated
 * with getDailySignalProfitStatistics().
 */
export async function getDailyStockSignals({
  marketCapRange,
  from,
  to,
  signalerProvider,
}: {
  marketCapRange: Range;
  signalerProvider: () => Signaler;
  from: Moment;
  to: Moment;
}): Promise<DailySignals> {
  const data = await stockDataStore.getDailyCandlesByMarketCap({
    from,
    to,
    marketCapRange,
  });

  const states: State[] = data.map((d) => ({
    ...d,
    nextIndex: 0,
    signaler: signalerProvider(),
  }));

  const results = [];

  while (true) {
    const nextTimestamps = states
      .map((s) => s.series[s.nextIndex]?.time)
      .filter((t) => !!t);

    if (!nextTimestamps.length) {
      break;
    }

    // Collect all stocks which have the same (smallest possible) timestamp on their next candle
    const included = states.reduce((result, next) => {
      const time = getNextTimestamp(next);
      if (!time) {
        return result;
      }
      if (!result.length) {
        return [next];
      }
      // Should be always defined, because otherwise wouldn't have been added to the list
      const currentMinTime = getNextTimestamp(result[0])!;

      const day = toStartOfDay(time);
      const currentMinDay = toStartOfDay(currentMinTime);

      if (day > currentMinDay) {
        return result;
      } else if (day === currentMinDay) {
        result.push(next);
        return result;
      } else {
        // New min timestamp found
        return [next];
      }
    }, [] as State[]);

    const signaled = included.filter((state) =>
      state.signaler(state.series.slice(0, state.nextIndex + 1))
    );

    if (signaled.length) {
      results.push({
        time: toStartOfDay(getNextTimestamp(signaled[0])!),
        stocks: signaled.map((s) => ({
          symbol: s.symbol,
          index: s.nextIndex,
          series: s.series,
        })),
      });
    }
    included.forEach((s) => s.nextIndex++);
  }
  return results;
}

export function getDailySignalProfitStatistics(
  signals: DailySignals,
  afterDays: number
) {
  const dailyProfits: number[] = flatMap(signals, (dailySignals) => {
    const profitsOfDay = dailySignals.stocks
      .filter((s) => s.series[s.index + afterDays])
      .map((s) => {
        const start = s.series[s.index].close;
        const end = s.series[s.index + afterDays].close;
        return (end - start) / start;
      });
    if (!profitsOfDay.length) {
      return [];
    }
    return [m.avg(profitsOfDay)];
  });
  return {
    count: dailyProfits.length,
    profitable: dailyProfits.filter((p) => p > 0).length / dailyProfits.length,
    avgProfit: m.avg(dailyProfits),
  };
}

async function example() {
  const signals = await getDailyStockSignals({
    marketCapRange: m.combineRanges(MARKET_CAPS.large, MARKET_CAPS.mega),
    from: "2020-10-20",
    to: "2021-08-01",
    signalerProvider: () => {
      const ind = new Indicators({
        donchianChannelPeriod: 100,
        smaPeriod: 100,
        atrPeriod: 10,
      });
      let lastDonchianBreakout = -Infinity;
      let lastSmaTouch = -Infinity;

      return (series) => {
        const candle = m.last(series);
        const { donchianChannel, sma, atr } = ind.update(series);
        const prev = ind.get(series[series.length - 2])?.donchianChannel;
        if (!donchianChannel || !prev || !sma || !atr) {
          return false;
        }
        if (donchianChannel.upper > prev.upper) {
          lastDonchianBreakout = candle.time;
          return false;
        }
        if (candle.low < sma) {
          lastSmaTouch = candle.time;
        }
        const signal =
          candle.time - lastDonchianBreakout < PERIODS.day * 14 &&
          lastSmaTouch > lastDonchianBreakout &&
          candle.open < candle.close;

        if (signal) {
          // Reset
          lastDonchianBreakout = -Infinity;
          lastSmaTouch = -Infinity;
        }
        return signal;
      };
    },
  });

  // console.log(
  //   signals.map((s) => ({
  //     t: toDateString(s.time),
  //     s: s.stocks.map((ss) => ss.symbol),
  //   }))
  // );

  console.log(getDailySignalProfitStatistics(signals, 1));
  console.log(getDailySignalProfitStatistics(signals, 3));
}

// example();
