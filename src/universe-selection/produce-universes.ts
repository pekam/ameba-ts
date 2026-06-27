import {
  findIndex,
  flatMap,
  groupBy,
  identity,
  map,
  mapValues,
  pipe,
  reduce,
  sortBy,
  toPairs,
} from "remeda";
import {
  Candle,
  PERIODS,
  Moment,
  timeframeToPeriod,
  toDateTime,
  toDateString,
  toTimestamp,
} from "..";
import { thenAll } from "../util/util";
import {
  GetUniverseSetArgs,
  SingleAssetUniverseFilter,
  Universe,
  UniverseAssetState,
} from "./get-universe-set";

/** Candles grouped by ISO date string. */
type DailyCandles = [string, Candle[]][];

export function produceUniverses(
  args: GetUniverseSetArgs
): Promise<Universe[]> {
  if (args.timeframe && timeframeToPeriod(args.timeframe) > PERIODS.day) {
    throw Error("Timeframe for universe selection must be daily or intraday");
  }
  if (args.lookback && hasNegativePeriodValue(args.lookback)) {
    throw Error("lookback values must be non-negative");
  }

  return pipe(
    args.symbols,
    map(getValidDatesForSymbol(args)),
    thenAll(mapByDate)
  );
}

function mapByDate(
  symbolsAndDates: { symbol: string; dates: string[] }[]
): Universe[] {
  return pipe(
    symbolsAndDates,
    flatMap(({ symbol, dates }) => map(dates, (date) => ({ symbol, date }))),
    groupBy(({ date }) => date),
    mapValues(map(({ symbol }) => symbol)),
    toPairs,
    sortBy(([date]) => date),
    map(([date, symbols]) => ({
      time: date,
      symbols,
    }))
  );
}

const getValidDatesForSymbol =
  (args: Omit<GetUniverseSetArgs, "symbols">) =>
  async (symbol: string): Promise<{ symbol: string; dates: string[] }> => {
    const allCandles = await args.dataProvider.getCandles({
      symbol,
      timeframe: args.timeframe || "1d",
      from: getCandleLoadStart(args),
      to: args.to,
    });

    const dailyCandles: DailyCandles = pipe(
      allCandles,
      groupBy((c) => toDateString(c.time, "d")),
      toPairs,

      // Just in case, ensuring the order of both the dates and the candles
      // within single date
      sortBy(([date, _candles]) => date),
      map(([date, candles]) => [date, sortBy(candles, (c) => c.time)])
    );

    const { lookbackDailyCandles, selectionDailyCandles } =
      splitBySelectionStart(dailyCandles, args.from);

    const dates = reduce(
      selectionDailyCandles,
      nextState(args),
      getInitialState(symbol, lookbackDailyCandles)
    ).selectedDates;
    return { symbol, dates };
  };

const hasNegativePeriodValue = (
  period: NonNullable<GetUniverseSetArgs["lookback"]>
): boolean =>
  pipe(period, Object.values, (periodValues) =>
    periodValues.some(
      (periodValue) => typeof periodValue === "number" && periodValue < 0
    )
  );

const getCandleLoadStart = (
  args: Omit<GetUniverseSetArgs, "symbols">
): Moment =>
  args.lookback ? toDateTime(args.from).minus(args.lookback) : args.from;

const splitBySelectionStart = (
  dailyCandles: DailyCandles,
  from: Moment
): {
  lookbackDailyCandles: DailyCandles;
  selectionDailyCandles: DailyCandles;
} => {
  const fromTimestamp = toTimestamp(from);
  const selectionStartIndex = pipe(
    dailyCandles,
    findIndex(([date]) => toTimestamp(date) >= fromTimestamp)
  );
  const splitIndex =
    selectionStartIndex === -1 ? dailyCandles.length : selectionStartIndex;

  return {
    lookbackDailyCandles: dailyCandles.slice(0, splitIndex),
    selectionDailyCandles: dailyCandles.slice(splitIndex),
  };
};

const getInitialState = (
  symbol: string,
  lookbackDailyCandles: DailyCandles
): UniverseAssetState => ({
  symbol,
  series: pipe(
    lookbackDailyCandles,
    flatMap(([_date, candles]) => candles)
  ),
  data: {},
  selected: false,
  selectedDates: [],
  currentDate: "", // This is set in the iteration before anything else
});

const nextState =
  (args: Omit<GetUniverseSetArgs, "symbols">) =>
  (state: UniverseAssetState, [date, daysCandles]: [string, Candle[]]) =>
    pipe(
      state,
      updateDate(date),
      addCandles(daysCandles),
      // if the filter passed on the previous iteration, this (the next candle
      // after) is the actual one that should be added (unless otherwise
      // specified)
      args.useCurrentDate ? identity : addCurrentDateIfSelected,
      runFilter(args.universeFilter),
      args.useCurrentDate ? addCurrentDateIfSelected : identity
    );

const updateDate =
  (date: string) =>
  (state: UniverseAssetState): UniverseAssetState => ({
    ...state,
    currentDate: date,
  });

const addCandles =
  (candles: Candle[]) =>
  (state: UniverseAssetState): UniverseAssetState => {
    // for perf
    state.series.push(...candles);
    return state;
  };

const addCurrentDateIfSelected = (
  state: UniverseAssetState
): UniverseAssetState => {
  if (state.selected) {
    // for perf
    state.selectedDates.push(state.currentDate);
  }
  return state;
};

const runFilter =
  (filter: SingleAssetUniverseFilter) =>
  (state: UniverseAssetState): UniverseAssetState => ({
    ...state,
    ...filter(state),
  });
