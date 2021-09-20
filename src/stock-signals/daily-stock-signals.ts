import { flatMap } from "lodash";
import { median } from "mathjs";
import { CandleSeries, Range, SeriesMap } from "../core/types";
import { stockDataStore } from "../data/stock-data-store";
import { m } from "../shared/functions";
import { Moment, toDateString, toStartOfDay } from "../shared/time-util";
const AsciiTable = require("ascii-table");

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
  signals: {
    time: number;
    stocks: {
      symbol: string;
      index: number;
    }[];
  }[];
  serieses: SeriesMap;
  args: StockSignalArgs;
};

interface StockSignalArgs {
  marketCapRange: Range;
  signalerProvider: () => Signaler;
  from: Moment;
  to: Moment;
}

/**
 * Returns an array with an entry for each day when there was at least one signal.
 * Each entry contains the list of stocks which signaled on that day.
 *
 * The profit statistics after N days of the signal occured can be calculated
 * with getDailySignalProfitStatistics().
 */
export async function getDailyStockSignals(
  args: StockSignalArgs
): Promise<DailySignals> {
  const { marketCapRange, from, to, signalerProvider } = args;
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

  const signals = [];

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
      signals.push({
        time: toStartOfDay(getNextTimestamp(signaled[0])!),
        stocks: signaled.map((s) => ({
          symbol: s.symbol,
          index: s.nextIndex,
        })),
      });
    }
    included.forEach((s) => s.nextIndex++);
  }
  return { signals, serieses: m.seriesWithSymbolsToMap(data), args };
}

interface SignalStatsInput {
  afterDays: number;
  relativeTo: "signalClose" | "currentOpen";
}

export function getDailySignalProfitStatistics({
  signals,
  afterDays,
  relativeTo,
}: SignalStatsInput & {
  signals: DailySignals;
}) {
  const dailyProfits: number[] = flatMap(signals.signals, (dailySignals) => {
    const profitsOfDay = flatMap(dailySignals.stocks, (s) => {
      const series = signals.serieses[s.symbol];
      const followingCandle = series[s.index + afterDays];
      if (!followingCandle) {
        return [];
      }
      const startPrice =
        relativeTo === "signalClose"
          ? series[s.index].close
          : followingCandle.open;
      const endPrice = followingCandle.close;
      return (endPrice - startPrice) / startPrice;
    });

    if (!profitsOfDay.length) {
      return [];
    }
    return [m.avg(profitsOfDay)];
  });

  const stats = {
    daysWithSignal: dailyProfits.length,
    ...profitsToStats(dailyProfits),
  };
  return stats;
}

function profitsToStats(profits: number[]) {
  return {
    profitable: profits.filter((p) => p > 0).length / profits.length,
    avgProfit: m.avg(profits),
    medianProfit: median(...profits),
  };
}

export async function reportSignalStats(
  signals: DailySignals,
  reportInputs: SignalStatsInput[]
) {
  const argsTable = new AsciiTable("Arguments");
  argsTable.removeBorder();
  argsTable.addRow(
    "Market cap (M)",
    signals.args.marketCapRange.from,
    "-",
    signals.args.marketCapRange.to
  );
  argsTable.addRow(
    "Time",
    toDateString(signals.args.from, "d"),
    "-",
    toDateString(signals.args.to, "d")
  );
  console.log();
  console.log(argsTable.toString());

  function addResultTable(signals: DailySignals, title: string) {
    const resultTable = new AsciiTable(title);
    resultTable.setHeading(
      "Days after signal",
      "Diff from",
      "Profitable",
      "Avg profit",
      "Median",
      "Sample size (days)"
    );
    reportInputs.forEach((input) => {
      const stats = getDailySignalProfitStatistics({ signals, ...input });

      let relativeTo;
      if (input.relativeTo === "signalClose") {
        relativeTo = "Signal close";
      } else if (input.relativeTo === "currentOpen") {
        relativeTo = "Candle open";
      }
      resultTable.addRow(
        input.afterDays,
        relativeTo,
        m.formatPercentage(stats.profitable, false),
        m.formatPercentage(stats.avgProfit),
        m.formatPercentage(stats.medianProfit),
        stats.daysWithSignal
      );
    });
    return resultTable.toString();
  }

  if (signals.signals.length) {
    console.log(addResultTable(signals, "Results"));

    /* Stats for all days (signaled or not) so that we can compare whether the signal
     * actually has an edge over buy-and-hold of every stock in the basket. */
    const all = await getDailyStockSignals({
      ...signals.args,
      signalerProvider: () => () => true,
    });
    console.log(addResultTable(all, "All (for comparison)"));
  } else {
    console.log("\n!!! No signals, no report !!!\n");
  }
}
