export type Dictionary<T> = Record<string, T>;

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
// TODO Enforce that R has only keys in T for extra type safety. The `R
// extends...` only helps with auto-suggestions, but doesn't prevent adding
// extra keys. Doing it the other way around (T extends R) does enforce it
// properly, but it causes errors if T has optional properties.
export type OverrideProps<
  T,
  R extends Partial<{ [key in keyof T]: any }>
> = Omit<T, keyof R> & R;
