import {
  balanceToMarketPosition,
  MarketPosition,
  marketPositionToBalance,
} from "../src";

it("should convert positive balance to long position", () =>
  expect(balanceToMarketPosition(1)).toEqual<MarketPosition>({
    side: "long",
    size: 1,
  }));

it("should convert negative balance to short position", () =>
  expect(balanceToMarketPosition(-1)).toEqual<MarketPosition>({
    side: "short",
    size: 1,
  }));

it("should convert zero balance to null", () =>
  expect(balanceToMarketPosition(0)).toEqual<MarketPosition | null>(null));

it("should convert long position to positive balance", () =>
  expect(marketPositionToBalance({ side: "long", size: 1 })).toBe(1));

it("should convert short position to negative balance", () =>
  expect(marketPositionToBalance({ side: "short", size: 1 })).toBe(-1));

it("should convert null position to zero balance", () =>
  expect(marketPositionToBalance(null)).toBe(0));

// Zero position should be indicated by null though
it("should convert zero position to zero balance", () =>
  expect(marketPositionToBalance({ side: "long", size: 0 })).toBe(0));
