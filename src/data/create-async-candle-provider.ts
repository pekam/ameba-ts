import { dropRightWhile, dropWhile } from "lodash/fp";
import { pipe, reverse } from "remeda";
import { AsyncCandleUpdateProvider } from "../core/backtest";
import {
  CandleUpdate,
  createCandleUpdates,
} from "../core/create-candle-updates";
import { Range } from "../core/types";
import { Moment, Timeframe, timeframeToPeriod, toTimestamp } from "../time";
import { then } from "../util/util";
import { CandleDataProvider, getMultiCandles } from "./candle-data-provider";

/**
 * Creates a backtester-compatible candle provider that fetches new candles on
 * demand from the given data provider.
 */
export function createAsyncCandleProvider(args: {
  dataProvider: CandleDataProvider;
  from: Moment;
  to: Moment;
  timeframe: Timeframe;
  symbols: string[];
  batchSize?: number;
}): AsyncCandleUpdateProvider {
  const { dataProvider, timeframe, symbols } = args;
  const timeframeAsPeriod = timeframeToPeriod(timeframe);
  const fullRange: Range = {
    from: toTimestamp(args.from),
    to: toTimestamp(args.to),
  };

  const periodToFetch = timeframeAsPeriod * (args.batchSize || 1000);

  const getNextBatch = (
    from: number,
    to: number,
    previousCandleTime: number | undefined
  ) =>
    pipe(
      getMultiCandles({
        symbols,
        dataProvider,
        from,
        to: Math.min(to, fullRange.to),
        timeframe,
      }),
      then(createCandleUpdates),
      then(
        dropWhile(
          (c: CandleUpdate) => c.time <= (previousCandleTime || -Infinity)
        )
      ),
      then(dropRightWhile((c) => c.time > fullRange.to)),
      then(reverse()) // for perf, removing from end
    );

  let candleUpdates: CandleUpdate[] = [];
  let startTime = toTimestamp(fullRange.from);

  return async (previousCandleTime) => {
    startTime = Math.max(startTime, previousCandleTime || -Infinity);
    while (!candleUpdates.length && startTime < fullRange.to) {
      const endTime = startTime + periodToFetch;
      candleUpdates = await getNextBatch(
        startTime,
        endTime,
        previousCandleTime
      );
      startTime = endTime;
    }

    if (!candleUpdates.length) {
      return undefined;
    }

    return candleUpdates.pop(); // array should be reversed
  };
}
