import os from "node:os";
import path from "node:path";

/** Reads an environment variable, treating blank values as unset. */
const envValue = (name: string): string | null => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
};

/**
 * The one directory all opess state lives in. `OPESS_CONFIG_DIR` overrides the
 * default `<home>/.config/opess`; an override is resolved as given (no `~`
 * expansion).
 */
export const resolveConfigDir = (): string => {
  const override = envValue("OPESS_CONFIG_DIR");
  return override ? path.resolve(override) : path.join(os.homedir(), ".config", "opess");
};

/**
 * The path to the encryption key file. `OPESS_SECRET_KEY_FILE` overrides the
 * default `<configDir>/secret.key`, so the key can be kept off the state disk.
 */
export const resolveKeyFile = (configDir: string): string => {
  const override = envValue("OPESS_SECRET_KEY_FILE");
  return override ? path.resolve(override) : path.join(configDir, "secret.key");
};
