/**
 * Returns the average of the provided numbers.
 */
export const avg: (values: number[]) => number = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
