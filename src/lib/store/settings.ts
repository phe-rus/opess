import type { Settings } from "./types";

/** One entry in the settings schema registry. */
type SettingDefinition = {
  type: "string" | "boolean" | "number";
  default: unknown;
  /** Allowed values, when the setting is an enum. */
  values?: readonly string[];
};

/**
 * The one registry of known settings: every key's type, default and allowed
 * values. Defaults are applied on read, and an unknown key is rejected on write
 * (spec AC-7).
 */
export const SETTINGS_SCHEMA = {
  "appearance.theme": {
    type: "string",
    default: "light",
    values: ["light", "dark", "system"],
  },
} as const satisfies Record<keyof Settings, SettingDefinition>;

export const SETTING_KEYS = Object.keys(SETTINGS_SCHEMA) as (keyof Settings)[];

export const isSettingKey = (key: string): key is keyof Settings =>
  Object.prototype.hasOwnProperty.call(SETTINGS_SCHEMA, key);

/** Every known setting at its default. */
export const defaultSettings = (): Settings => ({
  "appearance.theme": "light",
});

const matchesType = (value: unknown, definition: SettingDefinition): boolean => {
  switch (definition.type) {
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
  }
};

export type SettingCheck = { ok: true } | { ok: false; message: string };

/** Rejects an unknown key or a value of the wrong type, with a clear message. */
export const validateSetting = (key: string, value: unknown): SettingCheck => {
  if (!isSettingKey(key)) {
    return { ok: false, message: `Unknown setting "${key}".` };
  }

  const definition: SettingDefinition = SETTINGS_SCHEMA[key];
  if (!matchesType(value, definition)) {
    return { ok: false, message: `Setting "${key}" must be a ${definition.type}.` };
  }

  if (definition.values && !(definition.values as readonly string[]).includes(value as string)) {
    return {
      ok: false,
      message: `Setting "${key}" must be one of: ${definition.values.join(", ")}.`,
    };
  }

  return { ok: true };
};

const resolveSetting = <K extends keyof Settings>(key: K, value: unknown): Settings[K] => {
  if (validateSetting(key, value).ok) return value as Settings[K];
  return SETTINGS_SCHEMA[key].default as Settings[K];
};

/**
 * Turns a stored settings map into a full settings object: known keys use the
 * stored value when valid, else the registry default. Unknown keys already on
 * disk are ignored here and left untouched on write (spec AC-7).
 */
export const resolveSettings = (stored: Record<string, unknown>): Settings => ({
  "appearance.theme": resolveSetting("appearance.theme", stored["appearance.theme"]),
});
