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

export interface GetUniverseSetArgs {
  symbols: string[];
  universeFilter: SingleAssetUniverseFilter;
  dataProvider: CandleDataProvider;
  from: Moment;
  to: Moment;
  /**
   * Timeframe of the candles loaded per each day. E.g. if set to "5min", on
   * each update, 5-minute candles for the full calendar day are added to
   * series, then user's universe filter is run.
   *
   * Must be daily ("1d") or an intraday timeframe. Defaults to "1d".
   */
  timeframe?: Timeframe;
  persistence?: {
    persister: Persister;
    key: string;
    /**
     * If set to true, a new universe set will be produced and persisted even if
     * a universe set with the same key already exists, overwriting the previous
     * one.
     */
    overwrite?: boolean;
  };
  /**
   * If set to true: When the universe filter returns true, the symbol will be
   * added to the universe at the date of the latest candle instead of the next
   * tradable date.
   *
   * This introduces the risk of look ahead bias: You're choosing to trade on a
   * day based on data that is available only after that day. That's why you
   * should also use an intraday filter in your strategy that makes sure that
   * the conditions of the universe filter are fulfilled before entering a
   * trade. This enables optimizing the backtest of intraday filters, by being
   * able to cut down the universe of assets with daily timeframe data.
   *
   * Examples:
   * - Check that the opening gap is greater than 10%. The gap data is available
   *   right from open, so this doesn't have look ahead bias.
   * - Intraday filter expects price to move up 10% from open. You can use
   *   universe filter that checks that the price from open to high is greater
   *   than 10%, to optimize the backtest without look ahead bias.
   */
  useCurrentDate?: boolean;
}

export type SingleAssetUniverseFilter = (
  state: UniverseAssetState
) => SingleAssetUniverseFilterUpdate;

export interface UniverseAssetState {
  symbol: string;
  series: Candle[];
  data: Dictionary<any>;
  selected: boolean;
  selectedDates: string[];
  currentDate: string;
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
  if (args.persistence && !args.persistence.overwrite) {
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
