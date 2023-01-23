import { pick } from "remeda";
import { toNewYorkTime, toTimestamp } from "../../src";

it("should keep the moment the same but change time zone to New York", () => {
  const moment: number = toTimestamp({
    year: 2023,
    month: 1,
    day: 1,
    hour: 12,
    minute: 55,
  });

  const nyTime = toNewYorkTime(moment);

  expect(pick(nyTime, ["year", "month", "day", "hour", "minute"])).toEqual({
    year: 2023,
    month: 1,
    day: 1,
    hour: 7,
    minute: 55,
  });

  expect(toTimestamp(nyTime)).toBe(moment);
});
