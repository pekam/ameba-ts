import { AssetState } from "../core/types";
import {
  getAdx,
  getAtr,
  getDonchianChannel,
  getEma,
  getRsi,
  getSma,
} from "../indicators";
import { ValueProvider } from "./types";

/**
 * The average directional index indicator as a {@link ValueProvider}.
 */
export const adx =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state: AssetState) =>
    getAdx(state, period, indexFromEnd)?.adx;

/**
 * The average true range indicator as a {@link ValueProvider}.
 */
export const atr =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state: AssetState) =>
    getAtr(state, period, indexFromEnd);

/**
 * The exponential moving average indicator as a {@link ValueProvider}.
 */
export const ema =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state: AssetState) =>
    getEma(state, period, indexFromEnd);

/**
 * The relative strength index indicator as a {@link ValueProvider}.
 */
export const rsi =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state: AssetState) =>
    getRsi(state, period, indexFromEnd);

/**
 * The simple moving average indicator as a {@link ValueProvider}.
 */
export const sma =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state: AssetState) =>
    getSma(state, period, indexFromEnd);

/**
 * A {@link ValueProvider} that returns the max price reached in the last
 * 'period' candles.
 */
export const trailingHigh =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state: AssetState) =>
    getDonchianChannel(state, period, indexFromEnd)?.upper;

/**
 * A {@link ValueProvider} that returns the min price reached in the last
 * 'period' candles.
 */
export const trailingLow =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state: AssetState) =>
    getDonchianChannel(state, period, indexFromEnd)?.lower;
