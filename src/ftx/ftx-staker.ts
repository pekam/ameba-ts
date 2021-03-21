import { FtxUtil } from "./ftx-util";
import { getRiskBasedOnDrawdown } from "../functions/risk-management";

function getStakeMultiplier(
  accountValue: number,
  peakAccountValueIfUsingRiskManagement?: number
) {
  if (peakAccountValueIfUsingRiskManagement === undefined) {
    return 1;
  } else {
    return getRiskBasedOnDrawdown({
      accountValue,
      peakAccountValue: peakAccountValueIfUsingRiskManagement,
      maxDrawdown: 0.1,
      maxRisk: 1,
      minRisk: 0.5,
    });
  }
}

/**
 *
 * @param ftxUtil
 * @param peakAccountValueIfUsingRiskManagement
 * Set to enable scaling down the stakes based on drawdown. The peak account value
 * needs to be provided here manually, because FTX doesn't have API to fetch it.
 * This is supported only for non-margin trading.
 */
export const getFtxStaker = (
  ftxUtil: FtxUtil,
  peakAccountValueIfUsingRiskManagement?: number
) => {
  async function howMuchCanBuy() {
    const {
      spotMarginEnabled,
      usd,
      coin,
      totalUsdValue,
      bid,
      collateral,
      leverage,
    } = await ftxUtil.getState();

    if (!spotMarginEnabled) {
      const stakeMultiplier = getStakeMultiplier(
        totalUsdValue,
        peakAccountValueIfUsingRiskManagement
      );
      const targetPositionUsdValue = totalUsdValue * stakeMultiplier;
      const currentPositionUsdValue = coin * bid;
      const howMuchStillCanBuyUsdValue = Math.max(
        targetPositionUsdValue - currentPositionUsdValue,
        0
      );
      console.log({
        totalUsdValue,
        stakeMultiplier,
        targetPositionUsdValue,
        currentPositionUsdValue,
        howMuchStillCanBuyUsdValue,
      });
      return {
        value: howMuchStillCanBuyUsdValue / bid,
        usdValue: howMuchStillCanBuyUsdValue,
        price: bid,
      };
    } else {
      const maxPosition = getMaxPositionOnMargin(collateral, leverage, bid);
      const diff = maxPosition - coin;
      const value = Math.max(diff, 0);
      return { value, usdValue: value * bid, price: bid };
    }
  }

  async function howMuchCanSell() {
    const {
      spotMarginEnabled,
      coin,
      ask,
      totalUsdValue,
      collateral,
      leverage,
    } = await ftxUtil.getState();

    if (!spotMarginEnabled) {
      return { value: coin, usdValue: coin * ask, price: ask };
    } else {
      const maxPosition = getMaxPositionOnMargin(collateral, leverage, ask);
      const diff = maxPosition + coin;
      const value = Math.max(diff, 0);
      return { value, usdValue: value * ask, price: ask };
    }
  }

  function getMaxPositionOnMargin(
    collateral: number,
    leverage: number,
    price: number
  ) {
    /*
     * Not using leverage at the moment, but the max leverage in FTX settings
     * needs to be more than 1x so it can go 1x collateral long/short.
     */
    const maxPositionUsd = collateral; /* * leverage */
    const maxPosition = maxPositionUsd / price;
    return maxPosition;
  }

  return {
    howMuchCanBuy,
    howMuchCanSell,
  };
};
