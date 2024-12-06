import { allPass } from "remeda";
import {
  AssetPredicate,
  getUniverseSet,
  GetUniverseSetArgs,
  gt,
  sma,
} from "../src";
import { last } from "../src/util/util";
import { testDataProvider } from "./test-data/test-data-provider";

describe("universe selection", () => {
  const predicates: AssetPredicate[] = [gt(sma(3), 1)];

  const args: GetUniverseSetArgs = {
    dataProvider: testDataProvider,
    from: "1970-01-01",
    to: "1970-01-06",
    symbols: ["foo", "bar"],
    universeFilter: (state) => ({
      selected: allPass(state, predicates),
    }),
  };

  it("should be able to use AssetPredicates", async () => {
    const universeSet = await getUniverseSet(args);

    expect(universeSet).toMatchInlineSnapshot(`
      {
        "dataProviderName": "test-data-provider",
        "from": 0,
        "to": 432000,
        "universes": [
          {
            "symbols": [
              "foo",
              "bar",
            ],
            "time": "1970-01-04",
          },
          {
            "symbols": [
              "foo",
              "bar",
            ],
            "time": "1970-01-05",
          },
        ],
      }
    `);
  });

  it("should add earlier dates when useCurrentDate=true", async () => {
    const universeSet = await getUniverseSet({ ...args, useCurrentDate: true });

    expect(universeSet).toMatchInlineSnapshot(`
      {
        "dataProviderName": "test-data-provider",
        "from": 0,
        "to": 432000,
        "universes": [
          {
            "symbols": [
              "foo",
              "bar",
            ],
            "time": "1970-01-03",
          },
          {
            "symbols": [
              "foo",
              "bar",
            ],
            "time": "1970-01-04",
          },
          {
            "symbols": [
              "foo",
              "bar",
            ],
            "time": "1970-01-05",
          },
        ],
      }
    `);
  });

  it("should work with intraday timeframe", async () => {
    let iterationData: {
      date: string;
      candleCount: number;
      close: number;
    }[] = [];

    const universeSet = await getUniverseSet({
      dataProvider: testDataProvider,
      from: "1970-01-01",
      to: "1970-01-03",
      timeframe: "1h",
      symbols: ["foo", "bar"],
      universeFilter: (state) => {
        iterationData.push({
          date: state.currentDate,
          candleCount: state.series.length,
          close: last(state.series).close,
        });
        return { selected: last(state.series).close < 30 };
      },
    });

    expect(iterationData).toMatchInlineSnapshot(`
      [
        {
          "candleCount": 24,
          "close": 26,
          "date": "1970-01-01",
        },
        {
          "candleCount": 48,
          "close": 50,
          "date": "1970-01-02",
        },
        {
          "candleCount": 24,
          "close": 26,
          "date": "1970-01-01",
        },
        {
          "candleCount": 48,
          "close": 50,
          "date": "1970-01-02",
        },
      ]
    `);
    expect(universeSet).toMatchInlineSnapshot(`
      {
        "dataProviderName": "test-data-provider",
        "from": 0,
        "to": 172800,
        "universes": [
          {
            "symbols": [
              "foo",
              "bar",
            ],
            "time": "1970-01-02",
          },
        ],
      }
    `);
  });
});
