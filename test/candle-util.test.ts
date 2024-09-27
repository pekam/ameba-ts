import { getDollarVolume } from "../src";

describe("getDollarVolume", () => {
  it("should calculate dollar volume", () =>
    expect(
      getDollarVolume({
        open: 30,
        high: 100,
        low: 20,
        close: 40,
        volume: 1000,
        time: 1,
      })
    ).toBe(60000));
});
