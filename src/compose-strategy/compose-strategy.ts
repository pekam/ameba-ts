import { allPass, filter, isDefined, map, pipe, reduce } from "remeda";
import {
  AssetState,
  CANCEL_ORDERS_UPDATE,
  PositionSide,
  SingleAssetStrategyUpdate,
  SizelessOrder,
  TradingStrategy,
} from "..";
import { AssetPredicate, Entry, Exit, STRATEGY_NOT_READY } from "./types";

export interface ComposeStrategyArgs {
  /**
   * Conditions that need to pass in order to enter a position.
   */
  filters: AssetPredicate[];
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
          return CANCEL_ORDERS_UPDATE;
        }

        const exitUpdate = resolveExits(args.exits, state, entryOrder);
        if (exitUpdate === STRATEGY_NOT_READY) {
          return CANCEL_ORDERS_UPDATE;
        }

        return { entryOrder, ...exitUpdate };
      } else {
        return CANCEL_ORDERS_UPDATE;
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
      state.position?.side || (entryOrder.side === "buy" ? "long" : "short");
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
