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
  /**
   * How many units to buy/sell.
   */
  size: number;
}

export type MarketPosition = "long" | "short";

export interface TradeState {
  /**
   * The account's cash balance.
   */
  cash: number;
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
  trades: Trade[];
}

export interface Transaction {
  /**
   * Defines if this is a buy or a sell transaction.
   */
  side: "buy" | "sell";
  /**
   * How many units were bought/sold.
   */
  size: number;
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
 * An update to the orders during strategy execution.
 *
 * The changes will be applied to the trade state
 * with the spread operator. This means that:
 * - You can skip a property to not change it.
 *   An empty object can be used to not make any
 *   changes to the trade state.
 * - To cancel an order, you need to explicitly
 *   provide null or undefined as the value.
 *
 * When in a position, changes to entryOrder
 * should not be made.
 */
export interface StrategyUpdate {
  entryOrder?: Order | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
}

export type Strategy = (state: TradeState) => StrategyUpdate;

export interface Trade {
  entry: Transaction;
  exit: Transaction;
  position: MarketPosition;
  absoluteProfit: number;
  /**
   * The relative win/loss in the
   * invested money. For example:
   * - 10% win: profit = 0.10
   * - 0.5% loss: profit = -0.005
   */
  relativeProfit: number;
}

export interface Range {
  readonly from: number;
  readonly to: number;
}

/**
 * Mapping from a symbol to the corresponding candle series.
 */
export type SeriesMap = { [key: string]: CandleSeries };
