import { MACD } from "technicalindicators";
import { Candle } from "..";
import { createIndicatorWithSettings } from "./indicator-util";

export interface MacdSettings {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
}

export interface MacdResult {
  macd: number;
  signal: number;
  histogram: number;
}

export const getMacd = createIndicatorWithSettings<MacdSettings, MacdResult>(
  "macd",
  (settings) => {
    const macd = new MACD({
      ...settings,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
      values: [],
    });

    return (c: Candle) => {
      const result = macd.nextValue(c.close);
      if (
        result === undefined ||
        result.MACD === undefined ||
        result.signal === undefined ||
        result.histogram === undefined
      ) {
        return undefined;
      }
      return {
        histogram: result.histogram,
        signal: result.signal,
        macd: result.MACD,
      };
    };
  }
);
