import { allPass } from "remeda";
import { AssetPredicate, getUniverseSet, gt, sma } from "../src";
import { testDataProvider } from "./test-data/test-data-provider";

describe("universe selection", () => {
  it("should be able to use AssetPredicates", async () => {
    const predicates: AssetPredicate[] = [gt(sma(3), 1)];

    const universeSet = await getUniverseSet({
      dataProvider: testDataProvider,
      from: "1970-01-01",
      to: "1970-01-06",
      symbols: ["foo", "bar"],
      universeFilter: (state) => ({
        selected: allPass(state, predicates),
      }),
    });

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
});
