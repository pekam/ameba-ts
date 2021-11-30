import { flatMap, sortBy } from "lodash";
import { Moment } from "../shared/time-util";
import { handleOrders, revertLastTransaction } from "./backtest";
import { convertToBacktestResult } from "./backtest-result";
import {
  CandleSeries,
  MarketPosition,
  Order,
  Range,
  SeriesMap,
  StrategyUpdate,
  Trade,
  TradeState,
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
  // showProgressBar?: boolean;
  from?: Moment;
  // to?: Moment;
}) {
  const defaults = { initialBalance: 10000, showProgressBar: true };
  const {
    stratProvider,
    multiSeries,
    initialBalance,
    // showProgressBar,
    from,
    // to,
  } = {
    ...defaults,
    ...args,
  };

  const strat: MultiAssetStrategy = stratProvider();

  const initialState: MultiAssetTradeState = {
    cash: initialBalance,
    assets: Object.entries(multiSeries).reduce<AssetMap>(
      (assets, [symbol, series]) => {
        const initialSeries = (() => {
          if (!from) {
            return [];
          }
          const firstCandleIndex = series.findIndex(
            (candle) => candle.time >= from
          );
          if (firstCandleIndex === -1) {
            return [];
          }
          return series.slice(0, firstCandleIndex);
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
          _fullSeries: series,
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

  let state = initialState;

  while (true) {
    state = addNextCandles(state);
    if (!state.updated.length) {
      // All candle series finished
      break;
    }
    state = applyStrategy(handleAllOrders(state), strat);
  }

  const range: Range = { from: firstCandleTime, to: state.time };

  state = Object.values(state.assets)
    .filter((a) => a.position)
    .reduce((state, asset) => {
      const nextTradeState = revertLastTransaction({
        ...asset,
        cash: state.cash,
      });

      return {
        ...state,
        cash: nextTradeState.cash,
        assets: {
          ...state.assets,
          [asset.symbol]: {
            ...asset,
            ...nextTradeState,
          },
        },
      };
    }, state);

  const allTrades: Trade[] = sortBy(
    flatMap(state.assets, (a) => a.trades),
    (t) => t.entry.time
  );
  return convertToBacktestResult(
    allTrades,
    Object.values(multiSeries),
    initialBalance,
    state.cash,
    range
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
    const tradeState: TradeState = {
      ...state.assets[symbol],
      cash: state.cash,
    };
    const nextTradeState = handleOrders(tradeState);

    return {
      ...state,
      cash: nextTradeState.cash,
      assets: {
        ...state.assets,
        [symbol]: {
          ...state.assets[symbol],
          ...nextTradeState,
        },
      },
    };
  }, state);
}

function applyStrategy(
  state: MultiAssetTradeState,
  strat: MultiAssetStrategy
): MultiAssetTradeState {
  const stratUpdates = strat(state);
  const assets = stratUpdates.reduce((assets, update) => {
    return {
      ...assets,
      [update.symbol]: {
        ...assets[update.symbol],
        ...update,
      },
    };
  }, state.assets);
  return {
    ...state,
    assets,
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
