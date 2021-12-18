import {} from "./backtest";
import {
  AssetState,
  FullStrategyUpdate,
  FullTradeState,
  FullTradingStrategy,
  Order,
  SingleAssetStrategyUpdate,
} from "./types";

/**
 * A function that implements a position sizing strategy. It takes the previous
 * state and the upcoming update (which doesn't have sizes on the entry orders)
 * and returns the position sizes which should be applied to the entry orders.
 * The return value is a mapping from an asset's symbol to the position size,
 * and it should include all the assets which have an `entryOrder` in the
 * upcoming update.
 *
 * Use {@link withStaker} to combine a {@link TradingStrategy} with a staker to
 * form a full strategy that can be executed with a backtester or a real broker.
 */
export type Staker = (
  state: FullTradeState,
  update: { [symbol: string]: StrategyUpdate }
) => { [symbol: string]: number };

/**
 * An {@link Order} which doens't have the 'size' property yet, as it is
 * expected to be provided later by a {@link Staker} function.
 */
export type SizelessOrder = Omit<Order, "size">;

/**
 * An update that a {@link TradingStrategy} wishes to make to the orders of an
 * asset. Refer to {@link AssetState} docs for details of the properties.
 *
 * The changes will be applied to the asset state with the spread operator. This
 * means that:
 * - You can skip a property to not change it. An empty object can be returned
 *   to not make any changes to the asset state.
 * - To cancel an order, you need to explicitly provide `null` or `undefined` as
 *   the value.
 *
 * When in a position, changes to `entryOrder` should not be made.
 */
// NOTE: JSDoc needs to be manually kept in sync with SingleAssetStrategyUpdate
// (for the relevant parts), because the docs can't be inherited.
export interface StrategyUpdate
  extends Omit<SingleAssetStrategyUpdate, "entryOrder"> {
  entryOrder?: SizelessOrder | null;
}

/**
 * A single-asset trading strategy without position sizing. It decides when to
 * enter and exit long or short positions on one asset.
 *
 * To actually run this strategy with a backtester or a real broker, you need to
 * combine it with a separate {@link Staker} which handles the position sizing,
 * by using {@link withStaker}. That will create a {@link FullTradingStrategy},
 * which can also trade multiple assets simultaneously, using signals provided
 * by this trading strategy and position sizes provided by the staker.
 */
export type TradingStrategy = (state: AssetState) => StrategyUpdate;

/**
 * Combines a single-asset trading strategy with a staker that handles position
 * sizing, forming a full strategy that can trade multiple assets
 * simultaneously. This {@link FullTradingStrategy} can then be backtested or
 * executed with a broker.
 *
 * @param stratProvider should return new instances of the same strategy, if the
 * strategy is stateful (e.g. keeping track of previous indicator values such as
 * moving averages in a closure, for performance reasons)
 */
export function withStaker(
  stratProvider: () => TradingStrategy,
  staker: Staker
): FullTradingStrategy {
  const individualStrats: { [symbol: string]: TradingStrategy } = {};

  return function (state: FullTradeState): FullStrategyUpdate {
    const sizelessUpdates = state.updated
      .map((symbol) => state.assets[symbol])
      .reduce<{ [symbol: string]: StrategyUpdate }>((updates, asset) => {
        if (!individualStrats[asset.symbol]) {
          individualStrats[asset.symbol] = stratProvider();
        }
        const strat = individualStrats[asset.symbol];

        const update = strat(state.assets[asset.symbol]);

        return { ...updates, [asset.symbol]: update };
      }, {});

    const stakes = staker(state, sizelessUpdates);

    return Object.entries(sizelessUpdates).reduce(
      (sizedUpdates, [symbol, update]) => {
        if (!update.entryOrder) {
          return { ...sizedUpdates, [symbol]: update };
        }
        const size = stakes[symbol];
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
        if (size === 0) {
          return {
            ...sizedUpdates,
            [symbol]: {
              ...update,
              entryOrder: null,
            },
          };
        }
        return {
          ...sizedUpdates,
          [symbol]: {
            ...update,
            entryOrder: {
              ...update.entryOrder,
              size,
            },
          },
        };
      },
      {}
    );
  };
}
