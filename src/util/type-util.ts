export type Dictionary<T> = { [key: string]: T };

/**
 * Partially overrides object property types.
 *
 * Example:
 * ```
 * interface Foo {
 *   a: string;
 *   b: string;
 * }
 * type Bar = OverrideProps<Foo, { a: number }>;
 * // = { a: number, b: string }
 * ```
 */
export type OverrideProps<T extends { [key in keyof R]: any }, R> = Omit<
  T,
  keyof R
> &
  R;
