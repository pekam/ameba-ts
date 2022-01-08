import { map, mapValues, pipe } from "remeda";
import {
  AssetState,
  FullStrategyUpdate,
  FullTradeState,
  FullTradingStrategy,
  Order,
  SingleAssetStrategyUpdate,
} from "../core/types";
import { Dictionary } from "../util/type-util";
import { fromPairs } from "../util/util";
import { Staker, StrategyUpdate, TradingStrategy } from "./types";

/**
 * Combines a single-asset trading strategy with a staker that handles position
 * sizing, forming a full strategy that can trade multiple assets
 * simultaneously. This {@link FullTradingStrategy} can then be backtested or
 * executed with a broker.
 *
 * @param strategy should be stateless, because the same strategy function may
 * be called for multiple assets
 */
export const withStaker = (
  strategy: TradingStrategy,
  staker: Staker
): FullTradingStrategy => (state: FullTradeState): FullStrategyUpdate => {
  const sizelessUpdates: Dictionary<StrategyUpdate> = getSizelessUpdates(
    state,
    strategy
  );
  const stakes: Dictionary<number> = staker(state, sizelessUpdates);
  return addSizesToUpdates(sizelessUpdates, stakes);
};

const getSizelessUpdates = (state: FullTradeState, strategy: TradingStrategy) =>
  pipe(
    state,
    getAssetsWithNewCandle,
    getSizelessUpdatesAsPairs(strategy),
    fromPairs
  );

const getAssetsWithNewCandle = (state: FullTradeState) =>
  state.updated.map((symbol) => state.assets[symbol]);

const getSizelessUpdatesAsPairs = (strategy: TradingStrategy) =>
  map((asset: AssetState): [string, StrategyUpdate] => [
    asset.symbol,
    strategy(asset),
  ]);

const addSizesToUpdates = (
  sizelessUpdates: Dictionary<StrategyUpdate>,
  stakes: Dictionary<number>
) =>
  mapValues(sizelessUpdates, (update, symbol) =>
    addSizeToUpdate(update, stakes[symbol], symbol)
  );

function addSizeToUpdate(
  update: StrategyUpdate,
  size: number,
  symbol: string
): SingleAssetStrategyUpdate {
  if (!update.entryOrder) {
    // TODO avoid this type assertion caused by TS language limitation. The only
    // difference between these two types is whether a defined entryOrder has
    // size, so they should be compatible when entryOrder is null or undefined.
    return update as SingleAssetStrategyUpdate;
  }

  validatePositionSize(size, symbol);

  // Cancel the entry if size would be 0
  const entryOrder: Order | null =
    size === 0 ? null : { ...update.entryOrder, size };

  return {
    ...update,
    entryOrder,
  };
}

function validatePositionSize(size: number | undefined, symbol: string) {
  if (size === undefined) {
    throw Error(
      `Staker did not return an order size for an updated symbol ${symbol}.`
    );
  }
  if (size < 0) {
    throw Error(
      `Staker returned a negative order size ${size} for symbol ${symbol}.`
    );
  }
}
