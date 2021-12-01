import { flatMap, flatten, sortBy, takeWhile } from "lodash";
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

export type AssetMap = { [symbol: string]: AssetState };

export interface MultiAssetTradeState {
  cash: number;

  assets: AssetMap;
  updated: string[];

  time: number;
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

  _fullSeries: CandleSeries;
}

export type MultiAssetStrategyUpdate = (StrategyUpdate & { symbol: string })[];

export type MultiAssetStrategy = (
  state: MultiAssetTradeState
) => MultiAssetStrategyUpdate;

export function backtestMultiple(args: {
  stratProvider: () => MultiAssetStrategy;
  multiSeries: SeriesMap;
  initialBalance?: number;
  showProgressBar?: boolean;
  from?: Moment;
  to?: Moment;
}) {
  const defaults = { initialBalance: 10000, showProgressBar: true };
  const {
    stratProvider,
    multiSeries,
    initialBalance,
    showProgressBar,
    from,
    to,
  } = {
    ...defaults,
    ...args,
  };

  const strat: MultiAssetStrategy = stratProvider();

  function isWithinRange(candle: Candle) {
    return (
      candle.time >= (from || -Infinity) && candle.time <= (to || Infinity)
    );
  }

  const initialState: MultiAssetTradeState = {
    cash: initialBalance,
    assets: Object.entries(multiSeries).reduce<AssetMap>(
      (assets, [symbol, series]) => {
        // Candles before 'from' are still included, to allow using historical
        // price data before the first new candle added during the backtest.
        const initialSeries = (() => {
          const firstCandleIndex = series.findIndex(isWithinRange);
          return firstCandleIndex === -1
            ? []
            : series.slice(0, firstCandleIndex);
        })();

        // Note that _fullSeries won't necessarily contain all candles provided
        // by the user, since this is where 'to' is enforced.
        const _fullSeries = to
          ? takeWhile(series, (candle) => candle.time <= to)
          : series;

        assets[symbol] = {
          symbol,
          series: initialSeries,
          position: null,
          entryOrder: null,
          takeProfit: null,
          stopLoss: null,
          transactions: [],
          trades: [],
          _fullSeries,
        };
        return assets;
      },
      {}
    ),
    updated: [],
    time: 0,
  };

  const assetsWithBacktestableCandles = Object.values(
    initialState.assets
  ).filter(hasNext);

  if (!assetsWithBacktestableCandles.length) {
    throw Error(
      "None of the series have candles to backtest " +
        "(possibly because of the provided 'from' argument)."
    );
  }

  const firstCandleTime = Math.min(
    ...assetsWithBacktestableCandles.map(getNextTime)
  );

  const iterationCount = new Set(
    flatten(Object.values(initialState.assets).map((a) => a._fullSeries))
      .filter(isWithinRange)
      .map((c) => c.time)
  ).size;

  const progressBar = startProgressBar(iterationCount, showProgressBar);

  let state = initialState;

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

function addNextCandles(state: MultiAssetTradeState): MultiAssetTradeState {
  const assets = Object.values(state.assets);

  // Collect all assets which will include a new candle
  // in the next update
  const [nextAssets, nextTime] = assets
    .filter(hasNext)
    .reduce<[AssetState[], number?]>(
      ([nextAssets, minTime], asset) => {
        const currentTime = getNextTime(asset);
        if (currentTime < (minTime || Infinity)) {
          return [[asset], currentTime];
        } else if (currentTime === minTime) {
          // Mutating for performance
          nextAssets.push(asset);
        }
        return [nextAssets, minTime];
      },
      [[], undefined]
    );

  // Mutating the candle arrays for performance; slice() has O(N)
  // complexity which is a real issue when backtesting big datasets.
  nextAssets.forEach((asset) => {
    asset.series.push(getNextCandle(asset));
  });

  return {
    ...state,
    updated: nextAssets.map((a) => a.symbol),
    time: nextTime || state.time,
  };
}

function handleAllOrders(state: MultiAssetTradeState): MultiAssetTradeState {
  return state.updated.reduce((state, symbol) => {
    const { asset, cash } = handleOrders({
      asset: state.assets[symbol],
      cash: state.cash,
    });
    return updateAsset(state, symbol, asset, cash);
  }, state);
}

function applyStrategy(
  state: MultiAssetTradeState,
  strat: MultiAssetStrategy
): MultiAssetTradeState {
  const stratUpdates = strat(state);
  const nextState: MultiAssetTradeState = stratUpdates.reduce(
    (state, update) => {
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
    },
    state
  );
  return nextState;
}

function revertUnclosedTrades(state: MultiAssetTradeState) {
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
  state: MultiAssetTradeState,
  symbol: string,
  update: StrategyUpdate,
  cash?: number
): MultiAssetTradeState {
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

function hasNext(assetState: AssetState) {
  return assetState.series.length < assetState._fullSeries.length;
}

function getNextCandle(assetState: AssetState) {
  return assetState._fullSeries[assetState.series.length];
}

function getNextTime(assetState: AssetState) {
  return getNextCandle(assetState).time;
}
