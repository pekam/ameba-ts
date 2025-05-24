import { AssetState, inRange, sma } from "../src";

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
