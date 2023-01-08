import { sumBy } from "lodash/fp";
import { keys, map, mapValues, pipe, values } from "remeda";
import { AssetMap, AssetState, FullTradeState } from "../core/types";
import { SizelessOrder, Staker, StrategyUpdate } from "../high-level-api/types";
import { Dictionary, OverrideProps } from "../util/type-util";
import {
  getExpectedFillPriceWithoutSlippage,
  hasOwnProperty,
  pickBy,
} from "../util/util";
import { AccountStats, getAccountStats, getExpectedExposure } from "./util";

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
export const createStaker = ({
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
}): Staker => (
  state: FullTradeState,
  updates: Dictionary<StrategyUpdate>
): Dictionary<number> => {
  const accountStats = getAccountStats(state);
  const maxCashRiskPerTrade = accountStats.accountBalance * maxRelativeRisk;

  // How much cash can be entered to new positions:
  const exposureToSpare = getExposureToSpare(
    accountStats,
    state.assets,
    updates,
    maxRelativeExposure
  );
  const updatesWithEntryOrderAndStopLoss = filterByEntryAndStopLoss(updates);
  const entryPrices = mapValues(
    updatesWithEntryOrderAndStopLoss,
    (update, symbol) =>
      getExpectedFillPriceWithoutSlippage(
        update.entryOrder,
        state.assets[symbol].series
      )
  );

  return pipe(
    updatesWithEntryOrderAndStopLoss,
    getCashStakesByRisk(maxCashRiskPerTrade, entryPrices),
    limitCashStakeByExposure(exposureToSpare),
    convertCashStakesToAssetQuantities(allowFractions, entryPrices)
  );
};

function getExposureToSpare(
  accountStats: AccountStats,
  assets: Dictionary<AssetState>,
  updates: Dictionary<StrategyUpdate>,
  maxRelativeExposure: number
) {
  const potentialExposureBeforeNewOrders =
    // The cash value of active positions:
    accountStats.exposure +
    // The cash value of new positions if all the pending entry orders would
    // be triggered:
    accountStats.pendingExposure -
    // Some of the pending exposure will be reduced, because the old entry
    // orders won't be there after this update:
    getExposureToBeCancelled(assets, updates);
  const maxExposure = maxRelativeExposure * accountStats.accountBalance;
  return maxExposure - potentialExposureBeforeNewOrders;
}

const getExposureToBeCancelled = (
  assets: AssetMap,
  updates: Dictionary<StrategyUpdate>
) =>
  pipe(
    updates,
    // Select assets whose entry is either cancelled or overridden with new order
    pickBy((update) => hasOwnProperty(update, "entryOrder")),
    keys,
    // Map to the old state (before the new update is applied)
    map((symbol) => assets[symbol]),
    sumBy(getExpectedExposure)
  );

const getCashStakesByRisk = (
  maxCashRiskPerTrade: number,
  entryPrices: Dictionary<number>
) =>
  mapValues<Dictionary<UpdateWithEntryAndStopLoss>, number>((update, symbol) =>
    getCashStakeByRisk({
      entryPrice: entryPrices[symbol],
      stopLoss: update.stopLoss,
      maxCashRiskPerTrade,
    })
  );

const getCashStakeByRisk = ({
  entryPrice,
  stopLoss,
  maxCashRiskPerTrade,
}: {
  entryPrice: number;
  stopLoss: number;
  maxCashRiskPerTrade: number;
}) => {
  const relativeRisk = Math.abs(entryPrice - stopLoss) / entryPrice;
  return maxCashRiskPerTrade / relativeRisk;
};

const limitCashStakeByExposure = (exposureToSpare: number) => (
  stakes: Dictionary<number>
) => {
  // Using reduce just to carry the remaining exposure would complicate things
  // quite much compared to having this mutable variable in very limited scope.
  let remainingExposureToSpare = exposureToSpare;
  return mapValues(stakes, (size) => {
    const adjustedSize = Math.max(0, Math.min(remainingExposureToSpare, size));
    remainingExposureToSpare -= adjustedSize;
    return adjustedSize;
  });
};

const convertCashStakesToAssetQuantities = (
  allowFractions: boolean,
  entryPrices: Dictionary<number>
) =>
  mapValues((cashPositionSize: number, symbol: string) => {
    const sizeWithFractions = cashPositionSize / entryPrices[symbol];
    return allowFractions ? sizeWithFractions : Math.floor(sizeWithFractions);
  });

type UpdateWithEntryAndStopLoss = OverrideProps<
  StrategyUpdate,
  { entryOrder: SizelessOrder; stopLoss: number }
>;

function filterByEntryAndStopLoss(
  updates: Dictionary<StrategyUpdate>
): Dictionary<UpdateWithEntryAndStopLoss> {
  const filtered = pickBy<StrategyUpdate>((update) => !!update.entryOrder)(
    updates
  );
  validateUpdateType(filtered);
  return filtered;
}

function validateUpdateType(
  updates: Dictionary<StrategyUpdate>
): asserts updates is Dictionary<UpdateWithEntryAndStopLoss> {
  values(updates).forEach((update) => {
    if (!update.entryOrder) {
      throw Error(
        "Expected only updates with entryOrder. " +
          "There's a bug in the staker implementation."
      );
    }
    if (!update.stopLoss) {
      throw Error(
        "The used staker requires that each strategy update " +
          "that has an entry order also includes a stop loss " +
          "in order to calculate the initial risk of the trade."
      );
    }
  });
}
