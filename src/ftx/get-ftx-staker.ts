import { FtxUtil } from "./ftx-util";

export const getFtxStaker = (ftxUtil: FtxUtil) => {
  async function howMuchCanBuy() {
    const {
      spotMarginEnabled,
      usd,
      coin,
      bid,
      collateral,
      leverage,
    } = await ftxUtil.getState();

    if (!spotMarginEnabled) {
      return { value: usd / bid, usdValue: usd, price: bid };
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
