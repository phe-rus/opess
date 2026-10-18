import type { CollectionName } from "./types";

/** One pure, forward only migration step for a collection. */
export type Migration = {
  /** The version this step reads. */
  from: number;
  /** The version this step produces. */
  to: number;
  /** Transforms the payload; must be pure and idempotent. */
  migrate: (payload: unknown) => unknown;
};

/** The schema version each collection is written and read at. */
export const CURRENT_VERSIONS: Record<CollectionName, number> = {
  settings: 1,
  account: 1,
  desktop: 1,
  apps: 1,
};

/**
 * Forward migrations, applied in order while a file's version is behind the
 * current one. Empty today: every collection starts at version 1. A migration
 * whose write fails simply re-runs on the next load, so steps stay pure.
 */
export const MIGRATIONS: Record<CollectionName, Migration[]> = {
  settings: [],
  account: [],
  desktop: [],
  apps: [],
};

export class MigrationError extends Error {}

/**
 * Runs the registered migrations for a collection and returns the upgraded
 * payload and version. Throws `MigrationError` when a step is missing, so the
 * caller can abort and leave the original file untouched.
 */
export const runMigrations = (
  name: CollectionName,
  version: number,
  payload: unknown,
): { version: number; payload: unknown } => {
  const target = CURRENT_VERSIONS[name];
  let currentVersion = version;
  let currentPayload = payload;

  while (currentVersion < target) {
    const step = MIGRATIONS[name].find((migration) => migration.from === currentVersion);
    if (!step) {
      throw new MigrationError(
        `No migration registered for "${name}" from version ${currentVersion}.`,
      );
    }
    currentPayload = step.migrate(currentPayload);
    currentVersion = step.to;
  }

  return { version: currentVersion, payload: currentPayload };
};
