import { m } from "../shared/functions";
import {
  AssetState,
  FullStrategyUpdate,
  FullTradeState,
  FullTradingStrategy,
} from "./backtest";
import { Order, SingleAssetStrategyUpdate } from "./types";

/**
 * A function that implements a position sizing strategy.
 * It takes the previous trade state and the upcoming update
 * (which doesn't have size on the entry order) and returns
 * the position size that should be applied to the entry order.
 *
 * Use {@link withStaker} to combine a {@link TradingStrategy}
 * with a Staker to form a full strategy that can be executed on
 * the backtester or on a real broker.
 */
export type Staker = (
  state: FullTradeState,
  update: { [symbol: string]: StrategyUpdate }
) => { [symbol: string]: number };

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
export interface StrategyUpdate
  extends Omit<SingleAssetStrategyUpdate, "entryOrder"> {
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
export type TradingStrategy = (state: AssetState) => StrategyUpdate;

/**
 * Combines a strategy which doesn't include positions sizing with a staker,
 * forming a full strategy that can be backtested or executed on a broker.
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

/**
 * Implementation of a common position sizing strategy, where the max risk of
 * one trade is a proportion of the account value.
 *
 * For example: "I want to risk max 2% of my account balance per trade."
 *
 * In addition, the max exposure relative to account balance can be defined, as
 * well as whether to allow fractioned positions (e.g. buying 2.25 units on a
 * forex or crypto market) or not (more common in stocks).
 */
export function createStaker({
  maxRelativeRisk,
  maxRelativeExposure,
  allowFractions,
}: {
  /**
   * How much of the current account balance can be lost in one trade.
   * For example 0.01 if you want to risk max 1% of your account per trade.
   */
  maxRelativeRisk: number;
  /**
   * What is the max combined position size relative to the account balance. For
   * example 1 to prevent using leverage, 3 to use max 3x leverage. This will
   * prevent setting new entry orders (or limit it's size) when the sum of
   * current exposure (value of open positions) and potential exposure (added
   * exposure if the all the open entry orders would trigger) reaches the limit.
   */
  maxRelativeExposure: number;
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
    state: FullTradeState,
    updates: { [symbol: string]: StrategyUpdate }
  ) => {
    const accountStats = getAccountStats(state);
    const { accountBalance, exposure } = accountStats;

    // Some of the pending exposure will be reduced, because the old entry
    // orders won't be there after this update.
    const exposureToBeCancelled = Object.entries(updates)
      .filter(([symbol, update]) => {
        const prop: keyof StrategyUpdate = "entryOrder"; // Just for type safety
        // Entry either cancelled or overridden with new order.
        return update.hasOwnProperty(prop);
      })
      .map(([symbol, update]) => state.assets[symbol].entryOrder)
      .reduce(
        (exp, previousEntryOrder) =>
          previousEntryOrder ? getExpectedExposure(previousEntryOrder) : exp,
        0
      );

    const maxExposure = maxRelativeExposure * accountBalance;

    return Object.entries(updates)
      .filter(([symbol, update]) => update.entryOrder)
      .reduce<{
        sizes: { [symbol: string]: number };
        potentialExposure: number;
      }>(
        // potentialExposure is the total value of all positions if all of the
        // entries would trigger
        ({ sizes, potentialExposure }, [symbol, update]) => {
          const { entryOrder, stopLoss } = update;
          if (!entryOrder || !stopLoss) {
            throw Error(
              "Entry order and stoploss should be defined for the used staker."
            );
          }
          const entryPrice = entryOrder.price;

          function getMaxPositionByRisk() {
            const risk = Math.abs(entryPrice - stopLoss!) / entryPrice;
            const maxAbsoluteRiskPerTrade = accountBalance * maxRelativeRisk;
            return maxAbsoluteRiskPerTrade / risk;
          }

          function getMaxPositionByExposure() {
            return Math.max(0, maxExposure - potentialExposure);
          }

          const size = (() => {
            const positionSizeInCash = Math.min(
              getMaxPositionByRisk(),
              getMaxPositionByExposure()
            );
            const sizeWithFractions = positionSizeInCash / entryPrice;
            return allowFractions
              ? sizeWithFractions
              : Math.floor(sizeWithFractions);
          })();

          return {
            sizes: { ...sizes, [symbol]: size },
            potentialExposure:
              potentialExposure + getExpectedExposure({ ...entryOrder, size }),
          };
        },
        {
          sizes: {},
          potentialExposure:
            exposure + accountStats.pendingExposure - exposureToBeCancelled,
        }
      ).sizes;
  };
}

function getAccountStats(
  state: FullTradeState
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
        const pendingPosition = getExpectedExposure(asset.entryOrder);
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

function getExpectedExposure(order: Order) {
  // This can be updated to add some safety margin to account for slippage. Note
  // that the same margin should then be separately added to position size
  // calculation.
  return order.size * order.price;
}

/**
 * Places the entire account balance on one trade, holding max one position at
 * any time. Allows fractions.
 */
export const allInStaker: Staker = createStaker({
  maxRelativeRisk: 1,
  maxRelativeExposure: 1,
  allowFractions: true,
});
