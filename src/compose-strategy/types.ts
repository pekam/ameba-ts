import { AssetState, SingleAssetStrategyUpdate, SizelessOrder } from "..";
import { Nullable } from "../util/type-util";

/**
 * A strategy component used with {@link composeStrategy} as an entry filter, or
 * as an exit filter with {@link conditionExit}.
 */
export type AssetPredicate = (state: AssetState) => boolean;

/**
 * A strategy component used to enter a position, to be used with
 * {@link composeStrategy}.
 *
 * A special value {@link STRATEGY_NOT_READY} can be returned to indicate that
 * the technical indicators used by this strategy component need more data
 * before making decisions. After it becomes ready (enough data is provided),
 * it's expected that it remains ready (the function should not return this
 * special value after it has returned a valid value).
 */
export type Entry = (
  state: AssetState
) => SizelessOrder | typeof STRATEGY_NOT_READY;

/**
 * A strategy component used to exit a position with {@link composeStrategy} (to
 * set the stop loss and/or take profit price levels).
 *
 * The exit functions are called when an entry order is set (to have initial
 * values for the exit price levels if the entry is triggered), and after each
 * new candle when in a position (to manage the exit price levels).
 *
 * If either stop loss or take profit is not provided, the existing value will
 * be used. To cancel an order, you need to explicitly pass null or undefined as
 * the value for the stop loss or take profit.
 *
 * A special value {@link STRATEGY_NOT_READY} can be returned to indicate that
 * the technical indicators used by this strategy component need more data
 * before making decisions. After it becomes ready (enough data is provided),
 * it's expected that it remains ready (the function should not return this
 * special value after it has returned a valid value).
 */
export type Exit = (
  state: AssetState,
  entryOrder: Nullable<SizelessOrder>
) =>
  | Pick<SingleAssetStrategyUpdate, "takeProfit" | "stopLoss">
  | typeof STRATEGY_NOT_READY;

/**
 * A special value that can be returned from a strategy component (entries,
 * exits) to indicate that it needs more price data before making decisions. For
 * example, if there's not enough candles to calculate the value of an indicator
 * used in the strategy.
 */
export const STRATEGY_NOT_READY = "notready";

/**
 * A function that gets a numeric value (usually the value of some technical
 * indicator) so it can be used with strategy components such as the {@link gt}
 * filter or the {@link limitBuyEntry}.
 */
export type ValueProvider = (state: AssetState) => number | undefined;
