import {
  Candle,
  CandleSeries,
  getAdx,
  getAtr,
  getAvgRelativeRange,
  getAvgVolume,
  getDonchianChannel,
  getEma,
  getKeltnerChannel,
  getMacd,
  getRsi,
  getSma,
} from "../src";
import { getIndicatorValue, SeriesAndData } from "../src/indicators/indicator";
import { testData } from "./test-data/testData";

let fullSeries: CandleSeries;
let mockState: SeriesAndData;

beforeEach(() => {
  fullSeries = testData.getSimpleTestData(5);
  mockState = {
    series: [],
    data: {},
  };
});

it("should calculate indicator values", () => {
  const result: (number | undefined)[] = [];

  fullSeries.forEach((nextCandle) => {
    mockState.series.push(nextCandle);

    const sma = getSma(mockState, 3);
    result.push(sma);
  });

  expect(result).toEqual([undefined, undefined, 3, 4, 5]);
});

it("should get previous indicator values", () => {
  mockState.series = fullSeries;

  expect(getSma(mockState, 3, 1)).toBe(4);
  expect(getSma(mockState, 3, 2)).toBe(3);
  expect(getSma(mockState, 3, 3)).toBe(undefined);
});

it("should support multiple SMA with different parameters", () => {
  const sma1: (number | undefined)[] = [];
  const sma3: (number | undefined)[] = [];

  fullSeries.forEach((nextCandle) => {
    mockState.series.push(nextCandle);

    sma1.push(getSma(mockState, 1));
    sma3.push(getSma(mockState, 3));
  });

  expect(sma1).toEqual([2, 3, 4, 5, 6]);
  expect(sma3).toEqual([undefined, undefined, 3, 4, 5]);
});

it("should call initializer once", () => {
  const initializer = jest.fn(() => (c: Candle) => c.close);

  fullSeries.forEach((nextCandle) => {
    mockState.series.push(nextCandle);
    getIndicatorValue(mockState, "my_indicator", initializer, 0);
  });

  expect(initializer).toBeCalledTimes(1);
});

it("should support multiple indicators with different settings", () => {
  fullSeries = testData.getBtcHourly().slice(0, 10);

  function getIndicators(setting: number) {
    return {
      adx: getAdx(mockState, setting),
      atr: getAtr(mockState, setting),
      avgRelRange: getAvgRelativeRange(mockState, setting),
      avgVol: getAvgVolume(mockState, setting),
      dc: getDonchianChannel(mockState, setting),
      ema: getEma(mockState, setting),
      kc: getKeltnerChannel(mockState, {
        atrPeriod: setting,
        maPeriod: setting,
        multiplier: 2,
      }),
      macd: getMacd(mockState, {
        fastPeriod: 2,
        slowPeriod: 3,
        signalPeriod: setting,
      }),
      rsi: getRsi(mockState, setting),
      sma: getSma(mockState, setting),
    };
  }

  fullSeries.forEach((nextCandle) => {
    mockState.series.push(nextCandle);

    // Calculate a couple of times for extra sanity checking
    getIndicators(3);
    const indicators = getIndicators(3);

    // Peeking implementation details to make sure that there's exactly one
    // store for each indicator-settings pair
    expect(Object.keys(mockState.data._indicators).length).toBe(
      Object.keys(indicators).length
    );
  });

  // Different settings should produce new indicator stores
  const indicators = getIndicators(5);
  expect(Object.keys(mockState.data._indicators).length).toBe(
    Object.keys(indicators).length * 2
  );

  // The values below have been verified to be close to the indicator values
  // provided by a charting platform.
  expect(indicators).toMatchInlineSnapshot(`
    {
      "adx": {
        "adx": 45.145700520328454,
        "mdi": 8.257667348282443,
        "pdi": 42.39683305720431,
      },
      "atr": 385.90656,
      "avgRelRange": 0.009468291431461794,
      "avgVol": 25687492.16444,
      "dc": {
        "lower": 43527,
        "middle": 44271.5,
        "upper": 45016,
      },
      "ema": 44575.75720164609,
      "kc": {
        "lower": 43803.94408164609,
        "middle": 44575.75720164609,
        "upper": 45347.57032164609,
      },
      "macd": {
        "histogram": 8.207271344561875,
        "macd": 98.09812838173093,
        "signal": 89.89085703716906,
      },
      "rsi": 82.69,
      "sma": 44505.8,
    }
  `);
});
