import { m } from "../../shared/functions";
import { Staker, StrategyUpdate } from "../staker";
import { FullTradeState, Order } from "../types";

/**
 * Implementation of a common position sizing strategy, where the max risk of
 * one trade is a proportion of the account value.
 *
 * In addition, the max exposure relative to account balance can be defined, as
 * well as whether to allow fractioned positions (e.g. buying 2.25 units on a
 * forex or crypto market) or not (more common in stocks).
 *
 * Example use case: "I want to risk max 2% of my account balance per trade, and
 * use max 50% leverage."
 */

export function createStaker({
  maxRelativeRisk,
  maxRelativeExposure,
  allowFractions,
}: {
  /**
   * How much of the current account balance can be lost in one trade. For
   * example 0.01 if you want to risk max 1% of your account per trade.
   */
  maxRelativeRisk: number;
  /**
   * What is the max combined position size relative to the account balance. For
   * example 1 to prevent using leverage, 3 to use max 3x leverage. This will
   * prevent activating a new entry order (or limit it's size) when the sum of
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
      // Entry either cancelled or overridden with new order.
      .filter(([symbol, update]) => m.hasOwnProperty(update, "entryOrder"))
      .map(([symbol, update]) => state.assets[symbol].entryOrder)
      .reduce(
        (exposure, previousEntryOrder) =>
          previousEntryOrder
            ? exposure + getExpectedExposure(previousEntryOrder)
            : exposure,
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
