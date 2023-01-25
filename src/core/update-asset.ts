import { BacktestState } from "./backtest";
import { AssetState } from "./types";

/**
 * Returns a new state after applying {@link update} to the asset with
 * {@link symbol}. If the update changes also the cash balance, provide the new
 * value as {@link cash}.
 */
export function updateAsset(
  state: BacktestState,
  symbol: string,
  update: Partial<AssetState>,
  cash?: number
): BacktestState {
  return {
    ...state,
    cash: cash !== undefined ? cash : state.cash,
    assets: {
      ...state.assets,
      [symbol]: {
        ...state.assets[symbol],
        ...update,
      },
    },
  };
}
