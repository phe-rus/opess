/** Small shared type guards and helpers for the store. */

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** True for a missing file (`ENOENT`) without importing the whole node error type. */
export const isNotFound = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "ENOENT";
