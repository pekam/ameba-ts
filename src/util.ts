/**
 * Returns the average of the provided numbers.
 */

export const avg: (values: number[]) => number = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Applies the function to the value if the condition is true, otherwise
 * returns the value.
 */
export const applyIf = <T>(condition: boolean, func: (T) => T, value: T): T => {
  if (condition) {
    return func(value);
  } else {
    return value;
  }
};
