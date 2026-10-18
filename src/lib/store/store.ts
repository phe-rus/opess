import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  cleanStaleTemps,
  ensureDir,
  pathExists,
  readJsonFile,
  withFileLock,
  writeJsonAtomic,
} from "./atomic";
import {
  decryptSecrets,
  defaultSecrets,
  encryptSecrets,
  isSecretEnvelope,
  resolveKey,
} from "./crypto";
import { errorMessage, isPlainObject } from "./guards";
import { CURRENT_VERSIONS, runMigrations } from "./migrations";
import { resolveConfigDir, resolveKeyFile } from "./paths";
import { defaultSettings, resolveSettings, validateSetting } from "./settings";
import type { SecretEnvelope } from "./crypto";
import type {
  AccountRecord,
  AppRecord,
  CollectionName,
  ConfigLocation,
  DesktopDocument,
  JsonValue,
  Secrets,
  SecretKey,
  Settings,
  StoreErrorCode,
  StoreResult,
  StoreWarning,
} from "./types";

/** A store failure carrying the error code the API surface reports. */
export class StoreFailure extends Error {
  readonly code: StoreErrorCode;

  constructor(code: StoreErrorCode, message: string) {
    super(message);
    this.name = "StoreFailure";
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/* Locations                                                                   */
/* -------------------------------------------------------------------------- */

let cachedConfigDir: string | null = null;

const configDir = (): string => (cachedConfigDir ??= resolveConfigDir());
const fileFor = (name: CollectionName): string => path.join(configDir(), `${name}.json`);
/** The payload key inside the file object. `desktop.json` holds a `desktops` map. */
const payloadKey = (name: CollectionName): string => (name === "desktop" ? "desktops" : name);
const secretsFile = (): string => path.join(configDir(), "secrets.enc");
const keyFile = (): string => resolveKeyFile(configDir());

/* -------------------------------------------------------------------------- */
/* Warnings                                                                    */
/* -------------------------------------------------------------------------- */

const warn = (collection: string, message: string): void => {
  console.warn(
    `[opess.store] ${JSON.stringify({ event: "store.unreadable", collection, message })}`,
  );
};

/* -------------------------------------------------------------------------- */
/* Default shapes                                                              */
/* -------------------------------------------------------------------------- */

const defaultDesktopDocument = (): DesktopDocument => ({
  windows: [],
  widgets: [],
  wallpaper: null,
  updatedAt: null,
});

const bootstrapAccount = (): AccountRecord => ({
  id: randomUUID(),
  displayName: "Owner",
  createdAt: new Date().toISOString(),
  passwordUpdatedAt: null,
});

/* -------------------------------------------------------------------------- */
/* Shape validation                                                            */
/* -------------------------------------------------------------------------- */

const parseAccount = (value: unknown): AccountRecord | null => {
  if (!isPlainObject(value)) return null;
  const { id, displayName, createdAt, passwordUpdatedAt } = value;
  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof displayName !== "string") return null;
  if (typeof createdAt !== "string") return null;
  if (passwordUpdatedAt !== null && typeof passwordUpdatedAt !== "string") return null;
  return {
    id,
    displayName,
    createdAt,
    passwordUpdatedAt: (passwordUpdatedAt as string | null) ?? null,
  };
};

const parseDesktopDocument = (value: unknown): DesktopDocument | null => {
  if (!isPlainObject(value)) return null;
  const { windows, widgets, wallpaper, updatedAt } = value;
  if (!Array.isArray(windows) || !Array.isArray(widgets)) return null;
  if (wallpaper !== null && typeof wallpaper !== "string") return null;
  if (updatedAt !== null && typeof updatedAt !== "string") return null;
  return {
    windows: windows as JsonValue[],
    widgets: widgets as JsonValue[],
    wallpaper: wallpaper as string | null,
    updatedAt: updatedAt as string | null,
  };
};

const parseDesktopMap = (payload: unknown): Record<string, DesktopDocument> | null => {
  if (!isPlainObject(payload)) return null;
  const map: Record<string, DesktopDocument> = {};
  for (const [id, document] of Object.entries(payload)) {
    const parsed = parseDesktopDocument(document);
    if (!parsed) return null;
    map[id] = parsed;
  }
  return map;
};

const parseAppRecord = (value: unknown): AppRecord | null => {
  if (!isPlainObject(value)) return null;
  const { id, kind, source, version, enabled, config, installedAt } = value;
  if (typeof id !== "string" || id.length === 0) return null;
  if (kind !== "container" && kind !== "plugin") return null;
  if (typeof source !== "string") return null;
  if (typeof version !== "string") return null;
  if (typeof enabled !== "boolean") return null;
  if (!isPlainObject(config)) return null;
  if (typeof installedAt !== "string") return null;
  return { id, kind, source, version, enabled, config: config as Record<string, JsonValue>, installedAt };
};

const parseApps = (payload: unknown): AppRecord[] | null => {
  if (!Array.isArray(payload)) return null;
  const records: AppRecord[] = [];
  for (const entry of payload) {
    const record = parseAppRecord(entry);
    if (!record) return null;
    records.push(record);
  }
  return records;
};

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                   */
/* -------------------------------------------------------------------------- */

let initPromise: Promise<void> | null = null;

const ensureInitialized = (): Promise<void> => {
  if (!initPromise) initPromise = initialize();
  return initPromise;
};

/** Resolves created directories and seeds any missing collection file (AC-1). */
const initialize = async (): Promise<void> => {
  const dir = configDir();
  await ensureDir(dir);
  await cleanStaleTemps(dir);
  await seedFile("settings");
  await seedFile("apps");
  await seedFile("account");
  // The desktop map is keyed by account id, so the account seeds first.
  await seedFile("desktop");
};

const seedFile = async (name: CollectionName): Promise<void> => {
  const file = fileFor(name);
  await withFileLock(file, async () => {
    if (await pathExists(file)) return;
    const payload = await seedPayload(name);
    await writeJsonAtomic(file, {
      version: CURRENT_VERSIONS[name],
      [payloadKey(name)]: payload,
    });
  });
};

const seedPayload = async (name: CollectionName): Promise<unknown> => {
  switch (name) {
    case "settings":
      // Seeded with an empty map; defaults are applied on read.
      return {};
    case "apps":
      return [];
    case "account":
      return bootstrapAccount();
    case "desktop": {
      const account = await readAccountDirect();
      const id = account?.id ?? randomUUID();
      return { [id]: defaultDesktopDocument() };
    }
  }
};

/** Reads the account without going through `ensureInitialized`, for bootstrap. */
const readAccountDirect = async (): Promise<AccountRecord | null> => {
  const read = await readJsonFile(fileFor("account"));
  if (read.state !== "ok" || !isPlainObject(read.value)) return null;
  return parseAccount(read.value.account);
};

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

type CollectionSpec<T> = {
  parse: (payload: unknown) => T | null;
  defaults: () => T;
};

type Loaded<T> =
  | { ok: true; data: T; warning: StoreWarning | null }
  | { ok: false; error: StoreErrorCode; message: string };

const settingsSpec: CollectionSpec<Settings> = {
  parse: (payload) => (isPlainObject(payload) ? resolveSettings(payload) : null),
  defaults: defaultSettings,
};

const accountSpec: CollectionSpec<AccountRecord> = {
  parse: parseAccount,
  defaults: bootstrapAccount,
};

const desktopSpec: CollectionSpec<Record<string, DesktopDocument>> = {
  parse: parseDesktopMap,
  defaults: () => ({}),
};

const appsSpec: CollectionSpec<AppRecord[]> = {
  parse: parseApps,
  defaults: () => [],
};

const corrupted = <T>(spec: CollectionSpec<T>, name: CollectionName, message: string): Loaded<T> => {
  warn(name, message);
  return { ok: true, data: spec.defaults(), warning: { code: "storeUnreadable", message } };
};

/**
 * Loads one collection: seeds it when missing, migrates it forward when old,
 * and loads defaults with a warning when it is corrupt (never overwriting the
 * file on a corrupt read). Aborts with `migrationFailed` when a migration
 * throws, leaving the original file unchanged (spec AC-4, AC-6).
 */
const loadCollection = async <T>(
  name: CollectionName,
  spec: CollectionSpec<T>,
): Promise<Loaded<T>> => {
  await ensureInitialized();
  const file = fileFor(name);

  try {
    return await withFileLock(file, async (): Promise<Loaded<T>> => {
      const read = await readJsonFile(file);

      if (read.state === "missing") {
        const seeded = await seedPayload(name);
        await writeJsonAtomic(file, {
          version: CURRENT_VERSIONS[name],
          [payloadKey(name)]: seeded,
        });
        return { ok: true, data: spec.parse(seeded) ?? spec.defaults(), warning: null };
      }

      if (read.state === "unreadable") {
        return corrupted(spec, name, read.message);
      }

      const raw = read.value;
      if (!isPlainObject(raw) || !Number.isInteger(raw.version)) {
        return corrupted(spec, name, `Collection "${name}" is missing an integer version.`);
      }

      const version = raw.version as number;
      const target = CURRENT_VERSIONS[name];
      if (version > target) {
        return corrupted(
          spec,
          name,
          `Collection "${name}" is version ${version}, newer than this build supports (${target}).`,
        );
      }

      let payload = raw[payloadKey(name)];
      if (version < target) {
        try {
          const migrated = runMigrations(name, version, payload);
          payload = migrated.payload;
          // Persist the bumped version only after a successful migration.
          await writeJsonAtomic(file, {
            version: migrated.version,
            [payloadKey(name)]: payload,
          });
        } catch (error) {
          const message = `Migration failed for "${name}": ${errorMessage(error)}`;
          console.warn(
            `[opess.store] ${JSON.stringify({ event: "store.migrationFailed", collection: name, message })}`,
          );
          return { ok: false, error: "migrationFailed", message };
        }
      }

      const parsed = spec.parse(payload);
      if (!parsed) {
        return corrupted(spec, name, `Collection "${name}" has an invalid shape.`);
      }
      return { ok: true, data: parsed, warning: null };
    });
  } catch (error) {
    return { ok: false, error: "storeUnreadable", message: errorMessage(error) };
  }
};

export const getSettings = async (): Promise<StoreResult<Settings>> =>
  loadCollection("settings", settingsSpec);

export const getAccount = async (): Promise<StoreResult<AccountRecord>> =>
  loadCollection("account", accountSpec);

export const listApps = async (): Promise<StoreResult<AppRecord[]>> =>
  loadCollection("apps", appsSpec);

export const getDesktop = async (): Promise<StoreResult<DesktopDocument>> => {
  const account = await loadCollection("account", accountSpec);
  if (!account.ok) return account;
  const desktops = await loadCollection("desktop", desktopSpec);
  if (!desktops.ok) return desktops;
  const document = desktops.data[account.data.id] ?? defaultDesktopDocument();
  return { ok: true, data: document, warning: desktops.warning };
};

export const getConfigLocation = async (): Promise<StoreResult<ConfigLocation>> => {
  await ensureInitialized();
  return {
    ok: true,
    data: { configDir: configDir(), keyFile: keyFile() },
    warning: null,
  };
};

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

type Produced<T> =
  | { ok: true; payload: unknown; data: T }
  | { ok: false; error: StoreErrorCode; message: string };

const readPayloadDirect = async (name: CollectionName): Promise<unknown> => {
  const read = await readJsonFile(fileFor(name));
  if (read.state !== "ok" || !isPlainObject(read.value)) return undefined;
  return read.value[payloadKey(name)];
};

const mutateCollection = async <T>(
  name: CollectionName,
  produce: (current: unknown) => Produced<T>,
): Promise<StoreResult<T>> => {
  await ensureInitialized();
  const file = fileFor(name);

  try {
    return await withFileLock(file, async (): Promise<StoreResult<T>> => {
      const produced = produce(await readPayloadDirect(name));
      if (!produced.ok) return produced;
      await writeJsonAtomic(file, {
        version: CURRENT_VERSIONS[name],
        [payloadKey(name)]: produced.payload,
      });
      return { ok: true, data: produced.data, warning: null };
    });
  } catch (error) {
    const message = errorMessage(error);
    warn(name, message);
    return { ok: false, error: "writeFailed", message };
  }
};

export const updateSettings = (patch: unknown): Promise<StoreResult<Settings>> =>
  mutateCollection<Settings>("settings", (current) => {
    if (!isPlainObject(patch)) {
      return { ok: false, error: "invalidKey", message: "Settings patch must be an object." };
    }

    for (const [key, value] of Object.entries(patch)) {
      const check = validateSetting(key, value);
      if (!check.ok) return { ok: false, error: "invalidKey", message: check.message };
    }

    // Unknown keys already on disk are preserved; only patched keys change.
    const next = { ...(isPlainObject(current) ? current : {}), ...patch };
    return { ok: true, payload: next, data: resolveSettings(next) };
  });

export const updateDesktop = async (
  document: unknown,
): Promise<StoreResult<DesktopDocument>> => {
  const account = await loadCollection("account", accountSpec);
  if (!account.ok) return account;

  // The store owns the timestamp, so desktop state carries a server clock.
  const candidate = {
    ...(isPlainObject(document) ? document : {}),
    updatedAt: new Date().toISOString(),
  };
  const saved = parseDesktopDocument(candidate);
  if (!saved) {
    return { ok: false, error: "invalidDocument", message: "Desktop document is invalid." };
  }

  return mutateCollection<DesktopDocument>("desktop", (current) => {
    const map = parseDesktopMap(current) ?? {};
    return { ok: true, payload: { ...map, [account.data.id]: saved }, data: saved };
  });
};

export const upsertApp = (record: unknown): Promise<StoreResult<AppRecord[]>> =>
  mutateCollection<AppRecord[]>("apps", (current) => {
    const parsed = parseAppRecord(record);
    if (!parsed) {
      return { ok: false, error: "invalidRecord", message: "App record is invalid." };
    }

    const list = parseApps(current) ?? [];
    const exists = list.some((entry) => entry.id === parsed.id);
    const next = exists
      ? list.map((entry) => (entry.id === parsed.id ? parsed : entry))
      : [...list, parsed];
    return { ok: true, payload: next, data: next };
  });

export const removeApp = (id: string): Promise<StoreResult<AppRecord[]>> =>
  mutateCollection<AppRecord[]>("apps", (current) => {
    const list = parseApps(current) ?? [];
    const next = list.filter((entry) => entry.id !== id);
    if (next.length === list.length) {
      return { ok: false, error: "notFound", message: `No app with id "${id}".` };
    }
    return { ok: true, payload: next, data: next };
  });

/* -------------------------------------------------------------------------- */
/* Secrets (server only, never exposed as a client callable function)          */
/* -------------------------------------------------------------------------- */

const safeDecrypt = (envelope: SecretEnvelope, key: Buffer): Secrets => {
  try {
    return decryptSecrets(envelope, key);
  } catch {
    // A corrupt or unreadable envelope starts fresh rather than crashing.
    return defaultSecrets();
  }
};

/** Reads secrets. Throws `keyMissing` (never regenerating) or `storeUnreadable`. */
export const readSecrets = async (): Promise<Secrets> => {
  await ensureInitialized();
  const file = secretsFile();

  const key = await withFileLock(file, () => resolveKey(keyFile(), file));
  if (!key) {
    throw new StoreFailure(
      "keyMissing",
      "secret.key is missing while secrets.enc exists; refusing to regenerate it.",
    );
  }

  const read = await readJsonFile(file);
  if (read.state === "missing") return defaultSecrets();
  if (read.state === "unreadable" || !isSecretEnvelope(read.value)) {
    throw new StoreFailure("storeUnreadable", "secrets.enc is not a valid encrypted envelope.");
  }

  try {
    return decryptSecrets(read.value, key);
  } catch (error) {
    throw new StoreFailure(
      "storeUnreadable",
      `Could not decrypt secrets.enc: ${errorMessage(error)}`,
    );
  }
};

/** Writes one top level secrets key, encrypting the whole object. */
export const writeSecrets = async (key: SecretKey, value: unknown): Promise<void> => {
  await ensureInitialized();
  const file = secretsFile();

  await withFileLock(file, async () => {
    const material = await resolveKey(keyFile(), file);
    if (!material) {
      throw new StoreFailure(
        "keyMissing",
        "secret.key is missing while secrets.enc exists; refusing to regenerate it.",
      );
    }

    const read = await readJsonFile(file);
    const current =
      read.state === "ok" && isSecretEnvelope(read.value)
        ? safeDecrypt(read.value, material)
        : defaultSecrets();

    const next: Secrets = { ...current, [key]: value as Secrets[SecretKey] };
    await writeJsonAtomic(file, encryptSecrets(next, material));
  });
};
