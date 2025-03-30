import { isDefined, isNumber } from "remeda";
import { AssetState, CandleDataPredicate, ValueProvider } from "../..";

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
  (v1, v2) => v1 <= v2
);

type ComparingPredicate = (
  valueProvider1: ValueProvider | number,
  valueProvider2: ValueProvider | number
) => CandleDataPredicate;

function getComparingPredicate(
  comparator: (value1: number, value2: number) => boolean
): ComparingPredicate {
  return (valueProvider1, valueProvider2) => (state) => {
    const value1 = getValue(valueProvider1, state);
    const value2 = getValue(valueProvider2, state);
    return isDefined(value1) && isDefined(value2) && comparator(value1, value2);
  };
}

function getValue(
  providerOrValue: ValueProvider | number,
  state: Pick<AssetState, "series" | "data">
): number | undefined {
  return isNumber(providerOrValue) ? providerOrValue : providerOrValue(state);
}
