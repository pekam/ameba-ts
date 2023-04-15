import { AssetState } from "../core/types";
import { getAdx, getDonchianChannel, getSma } from "../indicators";
import { ValueProvider } from "./types";

/**
 * The simple moving average indicator as a {@link ValueProvider}.
 */
export const sma =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state: AssetState) =>
    getSma(state, period, indexFromEnd);

/**
 * The average directional index indicator as a {@link ValueProvider}.
 */
export const adx =
  (period: number, indexFromEnd?: number): ValueProvider =>
  (state: AssetState) =>
    getAdx(state, period, indexFromEnd)?.adx;

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
