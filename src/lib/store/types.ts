/**
 * Shared types for the opess data & config store (spec 0001).
 *
 * These describe both the on disk shapes and the shapes the server functions
 * hand back. The store runs on the server only; the browser reaches it through
 * the server functions in `@/hooks/use-store`.
 */

/** Any value that survives a round trip through JSON and a server function. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** The appearance theme. `system` follows the operating system preference. */
export type ThemeSetting = "light" | "dark" | "system";

/**
 * Known settings, keyed by a namespaced name and typed by value. Keys, types
 * and defaults live in the settings schema registry (`./settings.ts`).
 */
export type Settings = {
  "appearance.theme": ThemeSetting;
};

/**
 * One desktop document, stored under the owner's account id inside
 * `desktop.json`. The window and widget entries are opaque to the store: only
 * the top level fields are validated.
 */
export type DesktopDocument = {
  windows: JsonValue[];
  widgets: JsonValue[];
  wallpaper: string | null;
  updatedAt: string | null;
};

/** Where an installed app comes from. */
export type AppKind = "container" | "plugin";

/** One installed app record in `apps.json`. */
export type AppRecord = {
  id: string;
  kind: AppKind;
  source: string;
  version: string;
  enabled: boolean;
  config: Record<string, JsonValue>;
  installedAt: string;
};

/** The owner account. Identity only, never secret material. */
export type AccountRecord = {
  id: string;
  displayName: string;
  createdAt: string;
  passwordUpdatedAt: string | null;
};

/** The decrypted shape of `secrets.enc`. */
export type Secrets = {
  credentials: {
    passwordHash: string | null;
    passkeys: JsonValue[];
    recoveryCodes: JsonValue[];
  };
  serviceTokens: Record<string, JsonValue>;
};

/** A top level key inside the secrets object. */
export type SecretKey = keyof Secrets;

/** Every collection opess keeps as its own JSON file. */
export type CollectionName = "settings" | "account" | "desktop" | "apps";

export const COLLECTION_NAMES: CollectionName[] = [
  "settings",
  "account",
  "desktop",
  "apps",
];

/** The error codes the store's API surface reports. */
export type StoreErrorCode =
  | "storeUnreadable"
  | "invalidKey"
  | "invalidDocument"
  | "invalidRecord"
  | "notFound"
  | "writeFailed"
  | "keyMissing"
  | "migrationFailed";

/** A non fatal problem surfaced alongside a successful read (spec AC-4). */
export type StoreWarning = {
  code: "storeUnreadable" | "migrationFailed";
  message: string;
};

/** Every store call resolves to this: data plus a warning, or an error. */
export type StoreResult<T> =
  | { ok: true; data: T; warning: StoreWarning | null }
  | { ok: false; error: StoreErrorCode; message: string };

/** The resolved on disk locations, shown in Settings (spec AC-8). */
export type ConfigLocation = {
  configDir: string;
  keyFile: string;
};
