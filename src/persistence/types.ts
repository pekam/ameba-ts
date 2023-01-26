import { Nullable } from "../util/type-util";

/**
 * Key-value-pair store for saving values on disk. Can be implemented e.g. by
 * writing to a file or storing into a database.
 */
export interface Persister {
  /**
   * Returns the persisted value, or null/undefined if the provided key does not
   * map to an existing value.
   */
  get: <T>(key: PersisterKey) => Promise<Nullable<T>>;
  /**
   * Persists the given value identified by the given key. Overrides any
   * existing value that has the same key.
   */
  set: <T>(key: PersisterKey, value: T) => Promise<void>;
}

/**
 * The combination of category and key uniquely identifies the persisted value
 * within the context of this framework.
 */
export interface PersisterKey {
  /**
   * Related values are stored in the same category. Can be used to better
   * organize the persisted values.
   */
  category: string;
  /**
   * Uniquely identifies a stored value within a category.
   */
  key: string;
}
