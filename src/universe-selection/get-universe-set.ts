import {
  Candle,
  CandleDataProvider,
  Moment,
  Persister,
  PersisterKey,
  Timeframe,
  toTimestamp,
} from "..";
import { Dictionary } from "../util/type-util";
import { produceUniverses } from "./produce-universes";

export const UNIVERSE_TIMEFRAME: Timeframe = "1d";

export interface GetUniverseSetArgs {
  symbols: string[];
  universeFilter: SingleAssetUniverseFilter;
  dataProvider: CandleDataProvider;
  from: Moment;
  to: Moment;
  persistence?: {
    persister: Persister;
    key: string;
  };
}

export type SingleAssetUniverseFilter = (
  state: UniverseAssetState
) => SingleAssetUniverseFilterUpdate;

export interface UniverseAssetState {
  symbol: string;
  series: Candle[];
  data: Dictionary<any>;
  selected: boolean;
  selectedDates: number[];
}

export type SingleAssetUniverseFilterUpdate = Pick<
  UniverseAssetState,
  "selected"
> &
  Partial<Pick<UniverseAssetState, "data">>;

/**
 * A set of symbols that are included in the universe of assets on a particular
 * date.
 */
export interface Universe {
  /**
   * Date string in ISO format.
   */
  time: string;
  /**
   * Symbols of assets that are included in the universe on the specified time.
   */
  symbols: string[];
}

/**
 * A set of universes (date and symbols included in the universe on that date).
 */
export interface UniverseSet {
  universes: Universe[];
  from: number;
  to: number;
  dataProviderName: string;
}

/**
 * Performs universe selection by checking which symbols pass the provided
 * filter function on which dates.
 *
 * Doing this kind of coarse filtering with daily data makes it feasible to e.g.
 * test an intraday strategy with the entire US stock market.
 */
export async function getUniverseSet(
  args: GetUniverseSetArgs
): Promise<UniverseSet> {
  if (args.persistence) {
    const persistedSet = await getPersistedUniverseSet(
      args.persistence.persister,
      args.persistence.key
    );
    if (persistedSet) {
      return persistedSet;
    }
  }

  const universeSet = await produceUniverseSet(args);
  if (args.persistence) {
    await args.persistence.persister.set<UniverseSet>(
      toPersisterKey(args.persistence.key),
      universeSet
    );
  }
  return universeSet;
}

async function produceUniverseSet(
  args: GetUniverseSetArgs
): Promise<UniverseSet> {
  const universes = await produceUniverses(args);
  return {
    universes,
    from: toTimestamp(args.from),
    to: toTimestamp(args.to),
    dataProviderName: args.dataProvider.name,
  };
}

const toPersisterKey = (key: string): PersisterKey => ({
  category: "universe",
  key,
});

/**
 * If a universe set with the provided key has been stored with the given
 * persister, returns that set.
 */
export async function getPersistedUniverseSet(
  persister: Persister,
  key: string
): Promise<UniverseSet | undefined> {
  const persistedSet = await persister.get<UniverseSet>(toPersisterKey(key));
  return persistedSet || undefined;
}
