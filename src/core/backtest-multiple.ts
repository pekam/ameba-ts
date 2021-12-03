import { flatMap, flatten, sortBy } from "lodash";
import { Moment } from "../shared/time-util";
import { startProgressBar } from "../util";
import {
  handleOrders,
  revertLastTransaction,
} from "./backtest-order-execution";
import { convertToBacktestResult } from "./backtest-result";
import {
  Candle,
  CandleSeries,
  MarketPosition,
  Order,
  SeriesMap,
  StrategyUpdate,
  Trade,
  Transaction,
} from "./types";

interface BacktestMultipleArgs {
  stratProvider: () => MultiAssetStrategy;
  multiSeries: SeriesMap;
  initialBalance?: number;
  showProgressBar?: boolean;
  from?: Moment;
  to?: Moment;
}

export type AssetMap = { [symbol: string]: AssetState };

export interface MultiAssetTradeState {
  cash: number;

  assets: AssetMap;
  updated: string[];

  time: number;
}

// Additional props that should not be visible to the Strategy implementor
interface InternalTradeState extends MultiAssetTradeState {
  args: Required<BacktestMultipleArgs>;
}

export interface AssetState {
  symbol: string;
  series: CandleSeries;

  entryOrder: Order | null;
  position: MarketPosition | null;
  takeProfit: number | null;
  stopLoss: number | null;

  transactions: Transaction[];
  trades: Trade[];
}

export type MultiAssetStrategyUpdate = (StrategyUpdate & { symbol: string })[];

export type MultiAssetStrategy = (
  state: MultiAssetTradeState
) => MultiAssetStrategyUpdate;

export function backtestMultiple(args: BacktestMultipleArgs) {
  const defaults = {
    initialBalance: 10000,
    showProgressBar: true,
    from: 0,
    to: Infinity,
  };
  return doBacktestMultiple({ ...defaults, ...args });
}

function doBacktestMultiple(args: Required<BacktestMultipleArgs>) {
  const { stratProvider, multiSeries, initialBalance, showProgressBar } = args;

  const strat: MultiAssetStrategy = stratProvider();

  let state: InternalTradeState = {
    cash: initialBalance,
    assets: Object.entries(multiSeries).reduce<AssetMap>(
      (assets, [symbol, series]) => {
        // Candles before 'from' are still included, to allow using historical
        // price data before the first new candle added during the backtest.
        const initialSeries = (() => {
          const firstCandleIndex = series.findIndex((c) =>
            isWithinRange(args, c)
          );
          return firstCandleIndex === -1
            ? []
            : series.slice(0, firstCandleIndex);
        })();

        assets[symbol] = {
          symbol,
          series: initialSeries,
          position: null,
          entryOrder: null,
          takeProfit: null,
          stopLoss: null,
          transactions: [],
          trades: [],
        };
        return assets;
      },
      {}
    ),
    updated: [],
    time: 0,
    args,
  };

  const assetsWithBacktestableCandles = Object.values(
    state.assets
  ).filter((a) => getNextCandle(state, a));

  if (!assetsWithBacktestableCandles.length) {
    throw Error(
      "None of the series have candles to backtest " +
        "(possibly because of the provided 'from' argument)."
    );
  }

  const firstCandleTime = Math.min(
    ...assetsWithBacktestableCandles.map((a) => getNextCandle(state, a)!.time)
  );

  const iterationCount = new Set(
    flatten(Object.values(multiSeries))
      .filter((c) => isWithinRange(args, c))
      .map((c) => c.time)
  ).size;

  const progressBar = startProgressBar(iterationCount, showProgressBar);

  while (true) {
    state = addNextCandles(state);
    if (!state.updated.length) {
      // All candle series finished
      break;
    }
    state = applyStrategy(handleAllOrders(state), strat);
    progressBar.increment();
  }
  progressBar.stop();

  // Only finished trades are included in the result. Another option would be to
  // close all open trades with the current market price, but exiting against
  // the strategy's logic would skew the result.
  state = revertUnclosedTrades(state);

  const allTrades: Trade[] = sortBy(
    flatMap(state.assets, (a) => a.trades),
    (t) => t.entry.time
  );
  return convertToBacktestResult(
    allTrades,
    Object.values(multiSeries),
    initialBalance,
    state.cash,
    { from: firstCandleTime, to: state.time }
  );
}

function addNextCandles(state: InternalTradeState): InternalTradeState {
  const assets = Object.values(state.assets);

  // Collect all assets which will include a new candle
  // in the next update
  const [nextAssets, nextTime] = assets.reduce<[AssetState[], number?]>(
    ([nextAssets, minTime], asset) => {
      const candle = getNextCandle(state, asset);
      if (!candle) {
        // This asset doesn't have further candles
        return [nextAssets, minTime];
      } else if (candle.time < (minTime || Infinity)) {
        return [[asset], candle.time];
      } else if (candle.time === minTime) {
        nextAssets.push(asset); // Mutating for performance
        return [nextAssets, minTime];
      } else return [nextAssets, minTime];
    },
    [[], undefined]
  );

  // Mutating the candle arrays for performance; slice() has O(N)
  // complexity which is a real issue when backtesting big datasets.
  nextAssets.forEach((asset) => {
    asset.series.push(getNextCandle(state, asset)!);
  });

  return {
    ...state,
    updated: nextAssets.map((a) => a.symbol),
    time: nextTime || state.time,
  };
}

function handleAllOrders(state: InternalTradeState): InternalTradeState {
  return state.updated.reduce((state, symbol) => {
    const { asset, cash } = handleOrders({
      asset: state.assets[symbol],
      cash: state.cash,
    });
    return updateAsset(state, symbol, asset, cash);
  }, state);
}

function applyStrategy(
  state: InternalTradeState,
  strat: MultiAssetStrategy
): InternalTradeState {
  const stratUpdates = strat(state);
  const nextState: InternalTradeState = stratUpdates.reduce((state, update) => {
    if (update.entryOrder && update.entryOrder.size <= 0) {
      throw Error(
        `Order size must be positive, but was ${update.entryOrder.size}.`
      );
    }
    if (state.assets[update.symbol].position && update.entryOrder) {
      throw Error(
        "Changing entry order while already in a position is not allowed."
      );
    }
    return updateAsset(state, update.symbol, update);
  }, state);
  return nextState;
}

function revertUnclosedTrades(state: InternalTradeState) {
  return Object.values(state.assets)
    .filter((a) => a.position)
    .reduce((state, asset) => {
      const { asset: nextAssetState, cash } = revertLastTransaction({
        asset,
        cash: state.cash,
      });

      return updateAsset(state, asset.symbol, nextAssetState, cash);
    }, state);
}

/**
 * Returns a new state after applying {@link update} to the asset with
 * {@link symbol}. If the update changes also the cash balance, provide the new
 * value as {@link cash}.
 */
function updateAsset(
  state: InternalTradeState,
  symbol: string,
  update: StrategyUpdate,
  cash?: number
): InternalTradeState {
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

function isWithinRange(args: Required<BacktestMultipleArgs>, candle: Candle) {
  return candle.time >= args.from && candle.time <= args.to;
}

function getNextCandle(state: InternalTradeState, asset: AssetState) {
  const next =
    state.args.multiSeries[asset.symbol][
      state.assets[asset.symbol].series.length
    ];
  return next && next.time <= state.args.to ? next : null;
}
