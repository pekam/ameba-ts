import { allPass } from "remeda";
import { AssetState, cancelOrders, SizelessOrder, TradingStrategy } from "..";
import { Nullable } from "../util/type-util";

/**
 * A strategy component used to decide whether an entry order can be placed, to
 * be used with {@link composeStrategy}.
 */
export type EntryFilter = (state: AssetState) => boolean;

/**
 * A strategy component used to enter a position, to be used with
 * {@link composeStrategy}.
 */
export type Entry = (
  state: AssetState
) => SizelessOrder | typeof STRATEGY_NOT_READY;

/**
 * A strategy component used to exit a position, to be used as either stop loss
 * or take profit with {@link composeStrategy}.
 */
export type Exit = (
  state: AssetState,
  entryOrder: Nullable<SizelessOrder>
) => Nullable<number> | typeof STRATEGY_NOT_READY;

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
   * Defines how the take profit order will be placed when in a position. The
   * take profit will be updated after each new candle while the position is
   * active.
   */
  takeProfit: Exit;
  /**
   * Defines how the stop loss order will be placed when in a position. The stop
   * loss will be updated after each new candle while the position is active.
   */
  stopLoss: Exit;
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

        const stopLoss = args.stopLoss(state, entryOrder);
        const takeProfit = args.takeProfit(state, entryOrder);

        if (
          stopLoss === STRATEGY_NOT_READY ||
          takeProfit === STRATEGY_NOT_READY
        ) {
          return cancelOrders;
        }
        return { entryOrder, stopLoss, takeProfit };
      } else {
        return cancelOrders;
      }
    } else {
      const takeProfit = args.takeProfit(state, state.entryOrder);
      const stopLoss = args.stopLoss(state, state.entryOrder);

      if (
        takeProfit === STRATEGY_NOT_READY ||
        stopLoss === STRATEGY_NOT_READY
      ) {
        throw Error("Exits should be ready after entered");
      }
      return {
        takeProfit,
        stopLoss,
      };
    }
  };
}
