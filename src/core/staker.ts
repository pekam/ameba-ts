import { m } from "../shared/functions";
import {
  AssetState,
  MultiAssetStrategy,
  MultiAssetStrategyUpdate,
  MultiAssetTradeState,
} from "./backtest-multiple";
import { Order, StrategyUpdate } from "./types";

/**
 * A function that implements a position sizing strategy.
 * It takes the previous trade state and the upcoming update
 * (which doesn't have size on the entry order) and returns
 * the position size that should be applied to the entry order.
 *
 * Use {@link withStaker} to combine a {@link SizelessStrategy}
 * with a Staker to form a full strategy that can be executed on
 * the backtester or on a real broker.
 */
export type Staker = (
  state: MultiAssetTradeState,
  update: (SizelessStrategyUpdate & { symbol: string })[]
) => { symbol: string; size: number }[];

/**
 * An {@link Order} which doens't have the 'size' property yet, as it
 * is expected to be provided later by a {@link Staker} function.
 */
export type SizelessOrder = Omit<Order, "size">;

/**
 * An update to the orders during strategy execution,
 * excluding position sizing.
 *
 * The changes will be applied to the trade state
 * with the spread operator. This means that:
 * - You can skip a property to not change it.
 *   An empty object can be used to not make any
 *   changes to the trade state.
 * - To cancel an order, you need to explicitly
 *   provide null or undefined as the value.
 *
 * When in a position, changes to entryOrder
 * should not be made.
 */
// NOTE: JSDoc needs to be manually kept in sync with StrategyUpdate
// (for the relevant parts), because the docs can't be inherited.
export interface SizelessStrategyUpdate
  extends Omit<StrategyUpdate, "entryOrder"> {
  entryOrder?: SizelessOrder | null;
}

/**
 * A trading strategy similar to {@link Strategy}, but without
 * position sizing. In practice this means that when setting an
 * entry order, it does not include the 'size' property to decide
 * how many units to buy or sell.
 *
 * To actually run this type of strategy on a backtester or a real
 * broker, you need to combine it with a separate {@link Staker} which
 * handles the position sizing, by using {@link withStaker}.
 */
export type SizelessStrategy = (state: AssetState) => SizelessStrategyUpdate;

/**
 * Combines a strategy which doesn't include positions sizing with a staker,
 * forming a full strategy that can be backtested or executed on a broker.
 */
export function withStaker(
  stratProvider: () => SizelessStrategy,
  staker: Staker
): MultiAssetStrategy {
  const individualStrats: { [symbol: string]: SizelessStrategy } = {};

  return function (state: MultiAssetTradeState): MultiAssetStrategyUpdate {
    const sizelessUpdates = state.updated
      .map((symbol) => state.assets[symbol])
      .map((asset) => {
        if (!individualStrats[asset.symbol]) {
          individualStrats[asset.symbol] = stratProvider();
        }
        const strat = individualStrats[asset.symbol];

        const update = strat(state.assets[asset.symbol]);

        return { symbol: asset.symbol, ...update };
      });
    const stakes = staker(state, sizelessUpdates);

    return sizelessUpdates.map((update) => {
      if (!update.entryOrder) {
        return update as StrategyUpdate & { symbol: string };
      }
      const size = stakes.find((s) => s.symbol === update.symbol)?.size;
      if (size === undefined) {
        throw Error(
          `Staker did not return an order size for an updated symbol ${update.symbol}.`
        );
      }
      if (size < 0) {
        throw Error(
          `Staker returned a negative order size ${size} for symbol ${update.symbol}.`
        );
      }
      if (size === 0) {
        return {
          ...update,
          entryOrder: null,
        };
      }
      return {
        ...update,
        entryOrder: {
          ...update.entryOrder,
          size,
        },
      };
    });
  };
}

/**
 * Implementation of a common position sizing strategy, where the max risk
 * of one trade is a proportion of the account value.
 *
 * For example: "I want to risk max 2% of my account balance per trade."
 *
 * In addition, the max position size relative to account balance can be
 * defined, as well as whether to allow fractioned positions (e.g. buying
 * 2.25 units on a forex or crypto market) or not (more common in stocks).
 */
export function createStaker({
  maxRelativeRisk,
  maxRelativePosition, // TODO rename to maxRelativeExposure
  allowFractions,
}: {
  /**
   * How much of the current account balance can be lost in one trade.
   * For example 0.01 if you want to risk max 1% of your account per trade.
   */
  maxRelativeRisk: number;
  /**
   * What is the max position size relative to the account balance.
   * For example 1 to prevent using leverage, 3 to use max 3x leverage.
   */
  maxRelativePosition: number;
  /**
   * Whether or not fractional positions are allowed. In general, fractional
   * positions are okay when trading currencies and cryptos, but not when
   * trading stocks (unless the broker offers fractional shares).
   *
   * If set to false, the position size will be rounded down to the nearest
   * whole number.
   */
  allowFractions: boolean;
}): Staker {
  return (
    state: MultiAssetTradeState,
    updates: (SizelessStrategyUpdate & { symbol: string })[]
  ) => {
    const { accountBalance, exposure, pendingExposure } = getAccountStats(
      state
    );
    const maxExposure = maxRelativePosition * accountBalance;

    return updates
      .filter((update) => update.entryOrder)
      .reduce<{
        sizes: { size: number; symbol: string }[];
        pendingExposure: number;
      }>(
        (acc, update) => {
          const { entryOrder, stopLoss } = update;
          if (!entryOrder || !stopLoss) {
            throw Error(
              "Entry order and stoploss should be defined for the used staker."
            );
          }
          const risk = Math.abs(entryOrder.price - stopLoss) / entryOrder.price;
          const maxAbsoluteRiskPerTrade = accountBalance * maxRelativeRisk;

          const potentialExposure = exposure + pendingExposure;

          const positionSizeInCash = Math.min(
            maxAbsoluteRiskPerTrade / risk,
            maxRelativePosition * accountBalance,
            Math.max(0, maxExposure - potentialExposure)
          );

          const sizeWithFractions = positionSizeInCash / entryOrder.price;
          const size = allowFractions
            ? sizeWithFractions
            : Math.floor(sizeWithFractions);

          return {
            sizes: [...acc.sizes, { size, symbol: update.symbol }],
            pendingExposure: pendingExposure + positionSizeInCash,
          };
        },
        {
          sizes: [],
          pendingExposure,
        }
      ).sizes;
  };
}

function getAccountStats(
  state: MultiAssetTradeState
): { accountBalance: number; exposure: number; pendingExposure: number } {
  return Object.values(state.assets).reduce(
    (acc, asset) => {
      if (asset.position) {
        const positionSize =
          asset.entryOrder!.size * m.last(asset.series).close;
        return {
          ...acc,
          accountBalance:
            acc.accountBalance +
            (asset.position === "long" ? positionSize : -positionSize),
          exposure: acc.exposure + positionSize,
        };
      } else if (asset.entryOrder) {
        const pendingPosition = asset.entryOrder.price * asset.entryOrder.size;
        return {
          ...acc,
          pendingExposure: acc.pendingExposure + pendingPosition,
        };
      } else {
        return acc;
      }
    },
    { accountBalance: state.cash, exposure: 0, pendingExposure: 0 }
  );
}

/**
 * Places the entire account balance on one trade, holding max one position at
 * any time. Allows fractions.
 */
export const allInStaker: Staker = createStaker({
  maxRelativeRisk: 1,
  maxRelativePosition: 1,
  allowFractions: true,
});
