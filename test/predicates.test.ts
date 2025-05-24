import { DateTime } from "luxon";
import { AssetState, inRange, maxTradesPerDay, sma, toTimestamp } from "../src";
import { mockAssetState, mockCandle, mockTrade } from "./test-data/mocks";

describe("inRange", () => {
  const state: Pick<AssetState, "series" | "data"> = {
    series: [
      {
        time: 1,
        open: 2,
        high: 4,
        low: 1,
        close: 3,
        volume: 100,
      },
      {
        time: 2,
        open: 3,
        high: 5,
        low: 2,
        close: 4,
        volume: 200,
      },
    ],
    data: {},
  };

  it("should work with numbers", () => {
    expect(inRange(10, 5, 15)(state)).toBe(true);
    expect(inRange(20, 5, 15)(state)).toBe(false);
  });

  it("min should be inclusive and max should be exclusive", () => {
    expect(inRange(4, 5, 15)(state)).toBe(false);
    expect(inRange(5, 5, 15)(state)).toBe(true);
    expect(inRange(14, 5, 15)(state)).toBe(true);
    expect(inRange(15, 5, 15)(state)).toBe(false);
  });

  it("should work with indicators", () => {
    expect(inRange(sma(2), 1, 5)(state)).toBe(true);
    expect(inRange(sma(2), 100, 150)(state)).toBe(false);
    expect(inRange(sma(2), 1, sma(1))(state)).toBe(true);
    expect(inRange(sma(2), sma(2), sma(1))(state)).toBe(true);
  });

  it("should return false if indicators not ready", () => {
    expect(inRange(sma(10), -100, 100)(state)).toBe(false);
    expect(inRange(90, sma(10), 100)(state)).toBe(false);
    expect(inRange(-90, -100, sma(10))(state)).toBe(false);
  });
});

describe("maxTradesPerDay", () => {
  it("should return true until the number of trades in calendar day is reached", () => {
    const nyTime = (date: string) =>
      toTimestamp(DateTime.fromISO(date, { zone: "America/New_York" }));

    const state: AssetState = mockAssetState({
      // Latest candle defines current time:
      series: [mockCandle({ time: nyTime("2020-01-02T12:00:00") })],
    });

    // 1 trade in the previous day
    state.trades.push(mockTrade(nyTime("2020-01-01T23:00:00")));
    expect(maxTradesPerDay(1)(state)).toBe(true);
    expect(maxTradesPerDay(2)(state)).toBe(true);

    // 1 trade yesterday, 1 trade today
    state.trades.push(mockTrade(nyTime("2020-01-02T01:00:00")));
    expect(maxTradesPerDay(1)(state)).toBe(false);
    expect(maxTradesPerDay(2)(state)).toBe(true);

    // 1 trade yesterday, 2 trades today
    state.trades.push(mockTrade(nyTime("2020-01-02T02:00:00")));
    expect(maxTradesPerDay(2)(state)).toBe(false);
    expect(maxTradesPerDay(3)(state)).toBe(true);
  });
});
