import { getInitialRisk } from "../src";
import { mockTrade } from "./test-data/mocks";

it("should calculate initial risk for a long position", () => {
  const trade = {
    ...mockTrade("2020-01-01"),
    initialStopLoss: 95,
  };

  expect(getInitialRisk(trade)).toBe(50);
});

it("should calculate initial risk for a short position", () => {
  const trade = {
    ...mockTrade("2020-01-01"),
    entry: {
      ...mockTrade("2020-01-01").entry,
      side: "sell" as const,
    },
    exit: {
      ...mockTrade("2020-01-01").exit,
      side: "buy" as const,
    },
    position: {
      side: "short" as const,
      size: 10,
    },
    initialStopLoss: 105,
  };

  expect(getInitialRisk(trade)).toBe(50);
});

it("should return null when initial stop loss is null", () => {
  const trade = {
    ...mockTrade("2020-01-01"),
    initialStopLoss: null,
  };

  expect(getInitialRisk(trade)).toBeNull();
});

it("should return null when initial stop loss is undefined", () => {
  const trade = mockTrade("2020-01-01");

  expect(getInitialRisk(trade)).toBeNull();
});
