import { OHLC } from "../core/types";

const open = (candle: OHLC) => candle.open;
const high = (candle: OHLC) => candle.high;
const low = (candle: OHLC) => candle.low;
const close = (candle: OHLC) => candle.close;

export const candleUtils = {
  open,
  high,
  low,
  close,
};
