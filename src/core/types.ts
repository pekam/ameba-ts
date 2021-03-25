export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Candle extends OHLC {
  volume?: number;
  time: number;
}

export type CandleSeries = Array<Candle>;

export interface Order {
  /**
   * Defines if this is a buy or a sell order.
   */
  side: "buy" | "sell";
  /**
   * Defines if this a limit order or a stop order.
   */
  type: "limit" | "stop";
  /**
   * Limit price for a limit order, or
   * stop price for a stop order.
   */
  price: number;
}

export type MarketPosition = "long" | "short";

export interface TradeState {
  /**
   * The price data up to the current moment.
   */
  series: CandleSeries;
  /**
   * The order that is placed to enter the trade.
   */
  entryOrder: Order | null;
  /**
   * After the entry order has been fulfilled, this defines
   * if we're in a long position (after a buy order) or a
   * short position (after a sell order).
   *
   * When we don't have an active position, this is falsy.
   */
  position: MarketPosition | null;
  /**
   * The price of the stop loss order that should be
   * placed after the entry order has been activated,
   * or that is currently active.
   */
  stopLoss: number | null;
  /**
   * The price of the profit taking order that should be
   * placed after the entry order has been activated, or
   * that is currently active.
   *
   * This can be left out, eg. when using a trailing
   * stop loss.
   */
  takeProfit: number | null;
  transactions: Transaction[];
}

export interface Transaction {
  /**
   * Defines if this is a buy or a sell transaction.
   */
  side: "buy" | "sell";
  /**
   * The order that was fulfilled to create the transaction.
   */
  order: Order;
  /**
   * The price at which the buy/sell occurred.
   */
  price: number;
  /**
   * The moment when the transaction took place, in unix time.
   */
  time: number;
}

/**
 * A function describing a trading strategy.
 * It takes the current state as an argument,
 * and returns updates to the state.
 *
 * When in a position, changes to entryOrder
 * should not be made, and they will be ignored.
 */
export interface StrategyUpdate {
  (tradeState: TradeState): {
    entryOrder?: Order | null;
    stopLoss?: number | null;
    takeProfit?: number | null;
  };
}

export interface Strategy {
  /**
   * Called once during a backtest,
   * right before calling update for
   * the first time.
   */
  init(tradeState: TradeState): void;
  /**
   * Called once per candle during
   * a backtest.
   *
   * @see StrategyUpdate
   */
  update: StrategyUpdate;
}

export interface Trade {
  entry: Transaction;
  exit: Transaction;
  position: MarketPosition;
  /**
   * The relative win/loss in the
   * invested money. For example:
   * - 10% win: profit = 0.10
   * - 0.5% loss: profit = -0.005
   */
  profit: number;
}
