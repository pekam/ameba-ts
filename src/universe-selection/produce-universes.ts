import {
  flatMap,
  groupBy,
  identity,
  map,
  mapValues,
  pick,
  pipe,
  reduce,
  sortBy,
  toPairs,
} from "remeda";
import { Candle, PERIODS, timeframeToPeriod, toDateString } from "..";
import { thenAll } from "../util/util";
import {
  GetUniverseSetArgs,
  SingleAssetUniverseFilter,
  Universe,
  UniverseAssetState,
} from "./get-universe-set";

export function produceUniverses(
  args: GetUniverseSetArgs
): Promise<Universe[]> {
  if (args.timeframe && timeframeToPeriod(args.timeframe) > PERIODS.day) {
    throw Error("Timeframe for universe selection must be daily or intraday");
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
      ...pick(args, ["from", "to"]),
    });

    const dailyCandles: [string, Candle[]][] = pipe(
      allCandles,
      groupBy((c) => toDateString(c.time, "d")),
      toPairs,

      // Just in case, ensuring the order of both the dates and the candles
      // within single date
      sortBy(([date, _candles]) => date),
      map(([date, candles]) => [date, sortBy(candles, (c) => c.time)])
    );

    const initialState: UniverseAssetState = {
      symbol,
      series: [],
      data: {},
      selected: false,
      selectedDates: [],
      currentDate: "", // This is set in the iteration before anything else
    };

    const dates = reduce(
      dailyCandles,
      nextState(args),
      initialState
    ).selectedDates;
    return { symbol, dates };
  };

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
