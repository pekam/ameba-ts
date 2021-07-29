import { backtestStrategy } from "../core/backtest";
import {
  CandleSeries,
  Strategy,
  StrategyUpdate,
  TradeState,
} from "../core/types";

/**
 * Trades with the provided strategy only if it was profitable
 * in the near past.
 */
export class TradeOnlyRecentlyProfitable implements Strategy {
  private readonly stratProvider: () => Strategy;
  private readonly strat: Strategy;
  private readonly backtestInterval: number;
  private readonly backtestCandleCount: number;
  private readonly resultThreshold: number;

  private enabled = false;

  /**
   * @param stratProvider
   * provider for the strategy to use
   * @param backtestInterval
   * how many candles between the backtest runs and thus
   * updating the condition to execute the strategy
   * @param backtestCandleCount
   * how many candles to include in the re-optimizing backtest
   * @param resultThreshold
   * the min profit the strategy should have generated in the backtest
   * to enable executing the strategy
   */
  constructor(
    stratProvider: () => Strategy,
    backtestInterval = 100,
    backtestCandleCount = 100,
    resultThreshold = 1.005
  ) {
    this.stratProvider = stratProvider;
    this.strat = stratProvider();
    this.backtestInterval = backtestInterval;
    this.backtestCandleCount = backtestCandleCount;
    this.resultThreshold = resultThreshold;
  }

  init(state: TradeState): void {
    this.strat.init(state);
  }

  update(state: TradeState): StrategyUpdate {
    this.updateEnabled(state.series);

    // Need to update indicators in all cases
    const update = this.strat.update(state);

    if (!state.position && !this.enabled) {
      // Not allowed to enter a trade
      return { entryOrder: null };
    } else {
      return update;
    }
  }

  private updateEnabled(series: CandleSeries) {
    if (
      series.length % this.backtestInterval === 0 &&
      series.length >= this.backtestCandleCount
    ) {
      const backtestResult = backtestStrategy(
        this.stratProvider,
        series.slice(-this.backtestCandleCount)
      );
      this.enabled = backtestResult.stats.result > this.resultThreshold;
    }
  }
}
