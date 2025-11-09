// src/lib/crud/utils.ts

/**
 * Remove properties with `undefined` or empty string values, converting them
 * to `null` so they can be stored consistently.
 */
export function normalizeUndefinedToNull<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      value === undefined || value === "" ? null : value,
    ]),
  ) as T;
}

/**
 * Return a shallow copy of the object without properties whose value is
 * `undefined`.
 */
export function omitUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
