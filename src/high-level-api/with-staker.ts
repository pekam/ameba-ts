import { pipe, reduce, toPairs } from "remeda";
import {
  AssetState,
  FullStrategyUpdate,
  FullTradeState,
  FullTradingStrategy,
  Order,
  SingleAssetStrategyUpdate,
} from "../core/types";
import { Dictionary } from "../util/type-util";
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
  const sizelessUpdates: Dictionary<StrategyUpdate> = pipe(
    state,
    getAssetsWithNewCandle,
    getStrategyUpdates(strategy)
  );

  const stakes: Dictionary<number> = staker(state, sizelessUpdates);

  return addSizesToStrategyUpdates(sizelessUpdates, stakes);
};

const getAssetsWithNewCandle = (state: FullTradeState) =>
  state.updated.map((symbol) => state.assets[symbol]);

const getStrategyUpdates = (strategy: TradingStrategy) =>
  reduce<AssetState, Dictionary<StrategyUpdate>>(
    (updates, asset) => ({ ...updates, [asset.symbol]: strategy(asset) }),
    {}
  );

const addSizesToStrategyUpdates = (
  sizelessUpdates: Dictionary<StrategyUpdate>,
  stakes: Dictionary<number>
) => pipe(sizelessUpdates, toPairs, collectUpdatesWithSizes(stakes));

const collectUpdatesWithSizes = (stakes: Dictionary<number>) =>
  reduce<[string, StrategyUpdate], FullStrategyUpdate>(
    (sizedUpdates, [symbol, update]) => ({
      ...sizedUpdates,
      [symbol]: addSizeToUpdate(symbol, update, stakes[symbol]),
    }),
    {}
  );

function addSizeToUpdate(
  symbol: string,
  update: StrategyUpdate,
  size: number
): SingleAssetStrategyUpdate {
  if (!update.entryOrder) {
    // TODO avoid this type assertion caused by TS language limitation
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
