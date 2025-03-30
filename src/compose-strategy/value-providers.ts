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
import { ValueProvider } from "./types";

/**
 * The average directional index indicator as a {@link ValueProvider}.
 */
export const adx =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state) =>
    getAdx(state, period, indexFromEnd)?.adx;

/**
 * The average true range indicator as a {@link ValueProvider}.
 */
export const atr =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state) =>
    getAtr(state, period, indexFromEnd);

/**
 * The exponential moving average indicator as a {@link ValueProvider}.
 */
export const ema =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state) =>
    getEma(state, period, indexFromEnd);

/**
 * The relative strength index indicator as a {@link ValueProvider}.
 */
export const rsi =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state) =>
    getRsi(state, period, indexFromEnd);

/**
 * The simple moving average indicator as a {@link ValueProvider}.
 */
export const sma =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state) =>
    getSma(state, period, indexFromEnd);

/**
 * A {@link ValueProvider} that returns the max price reached in the last
 * 'period' candles.
 */
export const trailingHigh =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state) =>
    getDonchianChannel(state, period, indexFromEnd)?.upper;

/**
 * A {@link ValueProvider} that returns the min price reached in the last
 * 'period' candles.
 */
export const trailingLow =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state) =>
    getDonchianChannel(state, period, indexFromEnd)?.lower;

/**
 * Average volume as a {@link ValueProvider}.
 */
export const avgVolume =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state) =>
    getAvgVolume(state, period, indexFromEnd);

/**
 * Dollar volume of the candle as a {@link ValueProvider}.
 */
export const dollarVolume =
  (indexFromEnd?: number): ValueProvider =>
  (state) => {
    const candle = get(state.series, -1 - (indexFromEnd || 0));
    return candle && getDollarVolume(candle);
  };

/**
 * Average dollar volume as a {@link ValueProvider}.
 */
export const avgDollarVolume =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state) =>
    getAvgDollarVolume(state, period, indexFromEnd);
