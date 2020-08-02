import { initTestData } from "./testData";
import { CandleSeries } from "../src/core/candle-series";
import { trailingLowExit } from "../src/strats/trailing-low-exit";

it("should set stop loss below latest low", () => {
  const series: CandleSeries = initTestData();

  expectResult(series.slice(0, 5), undefined);

  expectResult(series.slice(0, 6), 2427.2869);
  expectResult(series.slice(0, 10), 2427.2869);

  expectResult(series.slice(0, 11), 2486.0921075);
  expectResult(series.slice(0, 21), 2486.0921075);

  expectResult(series, 2617.065355);
});

function expectResult(series: CandleSeries, stopLoss: number) {
  const stateUpdate = trailingLowExit({
    series,
    position: "long",
    entryOrder: null,
    stopLoss: 0,
    takeProfit: 0,
    transactions: [],
  });

  expect(stateUpdate).toEqual({ stopLoss });
}

it("should should not decrease stop loss", () => {
  const series: CandleSeries = initTestData();

  const stateUpdate = trailingLowExit({
    series,
    position: "long",
    entryOrder: null,
    stopLoss: 2620,
    takeProfit: 0,
    transactions: [],
  });

  expect(stateUpdate).toEqual({});
});
