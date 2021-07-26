import { FtxResolution } from "../ftx/ftx";

const second = 1,
  minute = second * 60,
  hour = minute * 60,
  day = hour * 24,
  week = day * 7;
/**
 * Time periods as seconds.
 */
export const PERIODS = {
  second,
  minute,
  hour,
  day,
  week,
};

export const ftxResolutionToPeriod: {
  [Property in FtxResolution]: number;
} = {
  "15sec": PERIODS.second * 15,
  "1min": PERIODS.minute,
  "5min": PERIODS.minute * 5,
  "15min": PERIODS.minute * 15,
  "1h": PERIODS.hour,
  "4h": PERIODS.hour * 4,
  "1d": PERIODS.day,
};
