import { pipe, reduce, values } from "remeda";
import { AssetState, FullTradeState, Order } from "..";
import { last } from "../util/util";

export interface AccountStats {
  /**
   * The sum of the account's cash balance and cash values of all open
   * positions (short positions reduce the balance).
   */
  accountBalance: number;
  /**
   * The sum of the absolute cash values of all open positions (both long and
   * short positions increase the exposure).
   */
  exposure: number;
  /**
   * The increase of exposure if all the currently open entry orders would be
   * filled at their limit/stop prices.
   */
  pendingExposure: number;
}

export const getAccountStats = (state: FullTradeState): AccountStats =>
  pipe(
    state.assets,
    values,
    reduce(addToAccountStats, {
      accountBalance: state.cash,
      exposure: 0,
      pendingExposure: 0,
    })
  );

function addToAccountStats(stats: AccountStats, asset: AssetState) {
  if (asset.position) {
    const positionSize = asset.position.size * last(asset.series).close;
    return {
      ...stats,
      accountBalance:
        stats.accountBalance +
        (asset.position.side === "long" ? positionSize : -positionSize),
      exposure: stats.exposure + positionSize,
    };
  } else if (asset.entryOrder) {
    const pendingPosition = getExpectedExposure(asset.entryOrder);
    return {
      ...stats,
      pendingExposure: stats.pendingExposure + pendingPosition,
    };
  } else {
    return stats;
  }
}

export function getExpectedExposure(order: Order) {
  // This can be updated to add some safety margin to account for slippage. Note
  // that the same margin should then be separately added to position size
  // calculation.
  return order.size * order.price;
}
