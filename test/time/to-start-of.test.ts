import { Moment, toStartOf, toTimestamp } from "../../src";

const input: Moment = "2023-05-13T08:42:15+00:00";

it("should convert time to start of year", () =>
  expect(toStartOf(input, "year")).toEqual(
    toTimestamp("2023-01-01T00:00:00+00:00")
  ));

it("should convert time to start of month", () =>
  expect(toStartOf(input, "month")).toEqual(
    toTimestamp("2023-05-01T00:00:00+00:00")
  ));

it("should convert time to start of day", () =>
  expect(toStartOf(input, "day")).toEqual(
    toTimestamp("2023-05-13T00:00:00+00:00")
  ));

it("should convert time to start of hour", () =>
  expect(toStartOf(input, "hour")).toEqual(
    toTimestamp("2023-05-13T08:00:00+00:00")
  ));

it("should convert time to start of minute", () =>
  expect(toStartOf(input, "minute")).toEqual(
    toTimestamp("2023-05-13T08:42:00+00:00")
  ));
