import { Candle } from "./loadData";

export interface Order {
  /**
   * Defines if this is a buy or a sell order.
   * By default it's a buy order.
   */
  sell?: boolean,
  /**
   * Defines if this a limit order or a stop order.
   */
  type: 'limit' | 'stop',
  /**
   * Limit price for a limit order, or
   * stop price for a stop order.
   */
  price: number
}

export interface TradeState {
  /**
   * The price data up to the current moment.
   */
  candles: Candle[],
  /**
   * The order that is placed to enter the trade.
   */
  entryOrder: Order,
  /**
   * After the entry order has been fulfilled, this defines
   * if we're in a long position (after a buy order) or a
   * short position (after a sell order).
   * 
   * When we don't have an active position, this is falsy.
   */
  position: 'long' | 'short',
  /**
   * The price of the stop loss order that should be
   * placed after the entry order has been activated,
   * or that is currently active.
   */
  stopLoss: number,
  /**
   * The price of the profit taking order that should be
   * placed after the entry order has been activated, or
   * that is currently active.
   * 
   * This can be left out, eg. when using a trailing
   * stop loss.
   */
  takeProfit: number
}

/**
 * A function describing a trading strategy.
 * It takes the current state as an argument,
 * and returns updates to the state.
 * 
 * When in a position, changes to entryOrder
 * should not be made, and they will be ignored.
 */
export interface Strategy {
  (tradeState: TradeState): {
    entryOrder?: Order,
    stopLoss?: number,
    takeProfit?: number
  }
}
