import { DateTime } from "luxon";
import { Trade } from "../../core/types";
import { toDateTime } from "../../time";
import { last, takeLastWhile } from "../../util/util";
import { AssetStatePredicate } from "../types";

/**
 * An entry filter that limits the number of trade entries per calendar day for
 * one asset.
 *
 * Note: The point of time for calendar day to change depends on the time zone.
 * This function assumes New York time zone unless otherwise specified.
 */
export const maxTradesPerDay =
  (maxTrades: number, timeZone?: string): AssetStatePredicate =>
  (state) => {
    const timeZoneToUse = timeZone ?? "America/New_York";
    const dateTimeNow = toDateTime(last(state.series).time).setZone(
      timeZoneToUse
    );
    const todaysEntries = takeLastWhile(
      state.trades,
      isOnSameDay(dateTimeNow, timeZoneToUse)
    );
    return todaysEntries.length < maxTrades;
  };

const isOnSameDay =
  (dateTime: DateTime, timeZone: string) => (trade: Trade) => {
    const dateTime2 = toDateTime(trade.entry.time).setZone(timeZone);
    return (
      dateTime.day === dateTime2.day &&
      dateTime.month === dateTime2.month &&
      dateTime.year === dateTime2.year
    );
  };
