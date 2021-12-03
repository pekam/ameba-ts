import { Order, Strategy, StrategyUpdate, TradeState } from "./types";

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
  state: TradeState,
  update: SizelessStrategyUpdate
) => number;

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
export type SizelessStrategy = (state: TradeState) => SizelessStrategyUpdate;

/**
 * Combines a strategy which doesn't include positions sizing with a staker,
 * forming a full strategy that can be backtested or executed on a broker.
 */
export function withStaker(
  strategy: SizelessStrategy,
  staker: Staker
): Strategy {
  return (state: TradeState) => {
    const sizelessUpdate = strategy(state);

    if (!sizelessUpdate.entryOrder) {
      return sizelessUpdate as StrategyUpdate;
    }

    const size = staker(state, sizelessUpdate);

    if (size < 0) {
      throw Error(
        `The order size must be non-negative, but staker returned ${size}.`
      );
    }

    if (size === 0) {
      return { entryOrder: null };
    }

    return {
      ...sizelessUpdate,
      entryOrder: {
        ...sizelessUpdate.entryOrder,
        size,
      },
    };
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
  maxRelativePosition,
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
  return (state: TradeState, update: SizelessStrategyUpdate) => {
    const { entryOrder, stopLoss } = update;
    if (!entryOrder || !stopLoss) {
      throw Error(
        "Entry order and stoploss should be defined for the used staker."
      );
    }
    const risk = Math.abs(entryOrder.price - stopLoss) / entryOrder.price;
    // NOTE: This assumes that only one asset is traded at a time,
    // so the full account balance is in cash when not in a position.
    // This might change when introducing multi-asset strategies.
    const accountBalance = state.cash;
    const maxAbsoluteRiskPerTrade = accountBalance * maxRelativeRisk;

    const positionSizeInCash = Math.min(
      maxAbsoluteRiskPerTrade / risk,
      maxRelativePosition * accountBalance
    );

    const size = positionSizeInCash / entryOrder.price;

    return allowFractions ? size : Math.floor(size);
  };
}

export const allInStaker: Staker = (state, update) =>
  state.cash / update.entryOrder!.price;
