import { allPass } from "remeda";
import {
  AssetPredicate,
  getUniverseSet,
  GetUniverseSetArgs,
  gt,
  sma,
} from "../src";
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
});
