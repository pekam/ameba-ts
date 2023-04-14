import { allPass, filter, isDefined, map, pipe, reduce } from "remeda";
import {
  AssetState,
  PositionSide,
  SingleAssetStrategyUpdate,
  SizelessOrder,
  TradingStrategy,
  cancelOrders,
} from "..";
import { Nullable } from "../util/type-util";

/**
 * A strategy component used to decide whether an entry order can be placed, to
 * be used with {@link composeStrategy}.
 */
export type EntryFilter = (state: AssetState) => boolean;

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

export interface ComposeStrategyArgs {
  /**
   * Conditions that need to pass in order to enter a position.
   */
  filters: EntryFilter[];
  /**
   * Defines how the entry order will be placed when all the filters are passed.
   */
  entry: Entry;
  /**
   * Set of exit strategies that update the stop loss and take profit price
   * levels. If multiple of the exit functions return a take profit, the last
   * one in the list will take effect. If there are multiple stop losses, the
   * one that is closest to the current price is used (to avoid increasing the
   * risk of the trade, which is a good principle in general).
   */
  exits: Exit[];
}

/**
 * Combines the given strategy components into a {@link TradingStrategy}. This
 * enables writing entry filters, entry strategies and exit strategies as a
 * reusable building blocks.
 */
export function composeStrategy(args: ComposeStrategyArgs): TradingStrategy {
  return (state) => {
    if (!state.position) {
      if (allPass(state, args.filters)) {
        const entryOrder = args.entry(state);

        if (!entryOrder || entryOrder === STRATEGY_NOT_READY) {
          return cancelOrders;
        }

        const exitUpdate = resolveExits(args.exits, state, entryOrder);
        if (exitUpdate === STRATEGY_NOT_READY) {
          return cancelOrders;
        }

        return { entryOrder, ...exitUpdate };
      } else {
        return cancelOrders;
      }
    } else {
      const exitUpdate = resolveExits(args.exits, state, state.entryOrder!);
      if (exitUpdate === STRATEGY_NOT_READY) {
        throw Error("Exits should be ready after entered");
      }
      return exitUpdate;
    }
  };
}

function resolveExits(
  exits: Exit[],
  state: AssetState,
  entryOrder: SizelessOrder
): SingleAssetStrategyUpdate | typeof STRATEGY_NOT_READY {
  const updates = exits.map((exit) => exit(state, entryOrder));
  if (allReady(updates)) {
    const positionSide: PositionSide =
      state.position?.side || entryOrder.side === "buy" ? "long" : "short";
    return pipe(
      updates,
      reduce(
        (combinedUpdate, update) => ({ ...combinedUpdate, ...update }),
        {}
      ),
      ensureNonIncreasingStopLoss(updates, positionSide)
    );
  } else {
    return STRATEGY_NOT_READY;
  }
}

function allReady<T>(
  updates: (T | typeof STRATEGY_NOT_READY)[]
): updates is T[] {
  return !updates.includes(STRATEGY_NOT_READY);
}

const ensureNonIncreasingStopLoss =
  (updates: SingleAssetStrategyUpdate[], positionSide: PositionSide) =>
  (combinedUpdate: SingleAssetStrategyUpdate) => {
    const stopLosses = pipe(
      updates,
      map((u) => u.stopLoss),
      filter(isDefined)
    );
    if (stopLosses.length < 2) {
      return combinedUpdate;
    }
    if (positionSide === "long") {
      return { ...combinedUpdate, stopLoss: Math.max(...stopLosses) };
    } else if (positionSide === "short") {
      return { ...combinedUpdate, stopLoss: Math.min(...stopLosses) };
    } else {
      const exhaustiveCheck: never = positionSide;
      return combinedUpdate;
    }
  };
