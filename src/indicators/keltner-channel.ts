import { KeltnerChannels } from "technicalindicators";
import {
  createIndicatorWithSettings,
  IndicatorChannel,
} from "./indicator-util";

export interface KeltnerChannelSettings {
  atrPeriod: number;
  maPeriod: number;
  multiplier: number;
  useSma?: boolean;
}

/**
 * Returns the value of a Keltner channel indicator.
 */
export const getKeltnerChannel = createIndicatorWithSettings<
  KeltnerChannelSettings,
  IndicatorChannel
>("keltnerChannel", (settings) => {
  const keltnerChannel = new KeltnerChannels({
    ...settings,
    high: [],
    low: [],
    close: [],
    useSMA: !!settings.useSma,
  });
  // @ts-ignore TS defs have wrong argument type
  return (c) => keltnerChannel.nextValue({ ...c });
});
