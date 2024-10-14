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
import { Candle, toDateString } from "..";
import { last, thenAll } from "../util/util";
import {
  GetUniverseSetArgs,
  SingleAssetUniverseFilter,
  Universe,
  UNIVERSE_TIMEFRAME,
  UniverseAssetState,
} from "./get-universe-set";

export function produceUniverses(
  args: GetUniverseSetArgs
): Promise<Universe[]> {
  return pipe(
    args.symbols,
    map(getValidDatesForSymbol(args)),
    thenAll(mapByDate)
  );
}

function mapByDate(
  symbolsAndDates: { symbol: string; dates: number[] }[]
): Universe[] {
  return pipe(
    symbolsAndDates,
    flatMap(({ symbol, dates }) => map(dates, (date) => ({ symbol, date }))),
    groupBy(({ date }) => date),
    mapValues(map(({ symbol }) => symbol)),
    toPairs,
    sortBy(([date]) => date),
    map(([date, symbols]) => ({
      time: toDateString(parseInt(date), "d"),
      symbols,
    }))
  );
}

const getValidDatesForSymbol =
  (args: Omit<GetUniverseSetArgs, "symbols">) =>
  async (symbol: string): Promise<{ symbol: string; dates: number[] }> => {
    const dailyCandles = await args.dataProvider.getCandles({
      symbol,
      timeframe: UNIVERSE_TIMEFRAME,
      ...pick(args, ["from", "to"]),
    });

    const initialState: UniverseAssetState = {
      symbol,
      series: [],
      data: {},
      selected: false,
      selectedDates: [],
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
  (state: UniverseAssetState, candle: Candle) =>
    pipe(
      state,
      addCandle(candle),
      // if the filter passed on the previous iteration, this (the next candle
      // after) is the actual one that should be added (unless otherwise
      // specified)
      args.useCurrentDate ? identity : addLatestCandleDate,
      runFilter(args.universeFilter),
      args.useCurrentDate ? addLatestCandleDate : identity
    );

const addCandle =
  (candle: Candle) =>
  (state: UniverseAssetState): UniverseAssetState => {
    // for perf
    state.series.push(candle);
    return state;
  };

function addLatestCandleDate(state: UniverseAssetState): UniverseAssetState {
  if (state.selected) {
    const time = last(state.series).time;
    // for perf
    state.selectedDates.push(time);
  }
  return state;
}

const runFilter =
  (filter: SingleAssetUniverseFilter) =>
  (state: UniverseAssetState): UniverseAssetState => ({
    ...state,
    ...filter(state),
  });
