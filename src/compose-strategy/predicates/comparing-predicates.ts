import { isDefined, isNumber } from "remeda";
import { AssetState, CandleDataPredicate, CandleDataToNumber } from "../..";

/**
 * A predicate that passes if the first provided value is less than the second.
 */
export const lt: ComparingPredicate = getComparingPredicate(
  (v1, v2) => v1 < v2
);
/**
 * A predicate that passes if the first provided value is greater than the
 * second.
 */
export const gt: ComparingPredicate = getComparingPredicate(
  (v1, v2) => v1 > v2
);
/**
 * A predicate that passes if the first provided value is less than or equal
 * compared to the second.
 */
export const lte: ComparingPredicate = getComparingPredicate(
  (v1, v2) => v1 <= v2
);
/**
 * A predicate that passes if the first provided value is greater than or equal
 * compared to the second.
 */
export const gte: ComparingPredicate = getComparingPredicate(
  (v1, v2) => v1 >= v2
);

type ComparingPredicate = (
  fnOrValue1: CandleDataToNumber | number,
  fnOrValue2: CandleDataToNumber | number
) => CandleDataPredicate;

function getComparingPredicate(
  comparator: (value1: number, value2: number) => boolean
): ComparingPredicate {
  return (fnOrValue1, fnOrValue2) => (state) => {
    const value1 = getValue(fnOrValue1, state);
    const value2 = getValue(fnOrValue2, state);
    return isDefined(value1) && isDefined(value2) && comparator(value1, value2);
  };
}

function getValue(
  fnOrValue: CandleDataToNumber | number,
  state: Pick<AssetState, "series" | "data">
): number | undefined {
  return isNumber(fnOrValue) ? fnOrValue : fnOrValue(state);
}
