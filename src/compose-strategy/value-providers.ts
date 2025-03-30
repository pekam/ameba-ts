import {
  getAdx,
  getAtr,
  getAvgDollarVolume,
  getAvgVolume,
  getDonchianChannel,
  getEma,
  getRsi,
  getSma,
} from "../indicators";
import { getDollarVolume } from "../util/candle-util";
import { get } from "../util/util";
import { CandleDataToNumber } from "./types";

/**
 * The average directional index indicator, curried.
 */
export const adx =
  (period: number, indexFromEnd?: number): CandleDataToNumber =>
  (state) =>
    getAdx(state, period, indexFromEnd)?.adx;

/**
 * The average true range indicator, curried.
 */
export const atr =
  (period: number, indexFromEnd?: number): CandleDataToNumber =>
  (state) =>
    getAtr(state, period, indexFromEnd);

/**
 * The exponential moving average indicator, curried.
 */
export const ema =
  (period: number, indexFromEnd?: number): CandleDataToNumber =>
  (state) =>
    getEma(state, period, indexFromEnd);

/**
 * The relative strength index indicator, curried.
 */
export const rsi =
  (period: number, indexFromEnd?: number): CandleDataToNumber =>
  (state) =>
    getRsi(state, period, indexFromEnd);

/**
 * The simple moving average indicator, curried.
 */
export const sma =
  (period: number, indexFromEnd?: number): CandleDataToNumber =>
  (state) =>
    getSma(state, period, indexFromEnd);

/**
 * An indicator that returns the max price reached in the last `period` candles,
 * curried.
 */
export const trailingHigh =
  (period: number, indexFromEnd?: number): CandleDataToNumber =>
  (state) =>
    getDonchianChannel(state, period, indexFromEnd)?.upper;

/**
 * An indicator that returns the min price reached in the last `period` candles,
 * curried.
 */
export const trailingLow =
  (period: number, indexFromEnd?: number): CandleDataToNumber =>
  (state) =>
    getDonchianChannel(state, period, indexFromEnd)?.lower;

/**
 * Average volume, curried.
 */
export const avgVolume =
  (period: number, indexFromEnd?: number): CandleDataToNumber =>
  (state) =>
    getAvgVolume(state, period, indexFromEnd);

/**
 * Dollar volume of the candle, curried.
 */
export const dollarVolume =
  (indexFromEnd?: number): CandleDataToNumber =>
  (state) => {
    const candle = get(state.series, -1 - (indexFromEnd || 0));
    return candle && getDollarVolume(candle);
  };

/**
 * Average dollar volume, curried.
 */
export const avgDollarVolume =
  (period: number, indexFromEnd?: number): CandleDataToNumber =>
  (state) =>
    getAvgDollarVolume(state, period, indexFromEnd);
