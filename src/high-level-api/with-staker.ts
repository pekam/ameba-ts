import {
  FullStrategyUpdate,
  FullTradeState,
  FullTradingStrategy,
} from "../core/types";
import { Staker, StrategyUpdate, TradingStrategy } from "./types";

/**
 * Combines a single-asset trading strategy with a staker that handles position
 * sizing, forming a full strategy that can trade multiple assets
 * simultaneously. This {@link FullTradingStrategy} can then be backtested or
 * executed with a broker.
 *
 * @param stratProvider should return new instances of the same strategy, if the
 * strategy is stateful (e.g. keeping track of previous indicator values such as
 * moving averages in a closure, for performance reasons)
 */

export function withStaker(
  stratProvider: () => TradingStrategy,
  staker: Staker
): FullTradingStrategy {
  const individualStrats: { [symbol: string]: TradingStrategy } = {};

  return function (state: FullTradeState): FullStrategyUpdate {
    const sizelessUpdates = state.updated
      .map((symbol) => state.assets[symbol])
      .reduce<{ [symbol: string]: StrategyUpdate }>((updates, asset) => {
        if (!individualStrats[asset.symbol]) {
          individualStrats[asset.symbol] = stratProvider();
        }
        const strat = individualStrats[asset.symbol];

        const update = strat(state.assets[asset.symbol]);

        return { ...updates, [asset.symbol]: update };
      }, {});

    const stakes = staker(state, sizelessUpdates);

    return Object.entries(sizelessUpdates).reduce(
      (sizedUpdates, [symbol, update]) => {
        if (!update.entryOrder) {
          return { ...sizedUpdates, [symbol]: update };
        }
        const size = stakes[symbol];
        if (size === undefined) {
          throw Error(
            `Staker did not return an order size for an updated symbol ${symbol}.`
          );
        }
        if (size < 0) {
          throw Error(
            `Staker returned a negative order size ${size} for symbol ${symbol}.`
          );
        }
        if (size === 0) {
          return {
            ...sizedUpdates,
            [symbol]: {
              ...update,
              entryOrder: null,
            },
          };
        }
        return {
          ...sizedUpdates,
          [symbol]: {
            ...update,
            entryOrder: {
              ...update.entryOrder,
              size,
            },
          },
        };
      },
      {}
    );
  };
}
