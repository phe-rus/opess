import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir, pathExists } from "./atomic";
import type { Secrets } from "./types";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const KEY_FILE_MODE = 0o600;

/** The on disk envelope for `secrets.enc`. Never contains plaintext. */
export type SecretEnvelope = {
  version: number;
  algo: typeof ALGORITHM;
  /** Base64, a fresh 12 byte initialisation vector per write. */
  iv: string;
  /** Base64, the 16 byte GCM authentication tag. */
  tag: string;
  /** Base64 ciphertext. */
  data: string;
};

/** The empty secrets object, used before anything has been saved. */
export const defaultSecrets = (): Secrets => ({
  credentials: { passwordHash: null, passkeys: [], recoveryCodes: [] },
  serviceTokens: {},
});

export const isSecretEnvelope = (value: unknown): value is SecretEnvelope => {
  if (typeof value !== "object" || value === null) return false;
  const envelope = value as Record<string, unknown>;
  return (
    typeof envelope.version === "number" &&
    envelope.algo === ALGORITHM &&
    typeof envelope.iv === "string" &&
    typeof envelope.tag === "string" &&
    typeof envelope.data === "string"
  );
};

/**
 * Returns the encryption key, generating it only when both the key and the
 * encrypted file are absent. When `secrets.enc` exists without its key, returns
 * `null`: the key is never regenerated, so the caller can fail with `keyMissing`.
 */
export const resolveKey = async (
  keyFile: string,
  secretsFile: string,
): Promise<Buffer | null> => {
  if (await pathExists(keyFile)) {
    return readFile(keyFile);
  }

  if (await pathExists(secretsFile)) {
    return null;
  }

  const key = randomBytes(KEY_BYTES);
  await ensureDir(path.dirname(keyFile));
  await writeFile(keyFile, key, { mode: KEY_FILE_MODE });
  await chmod(keyFile, KEY_FILE_MODE).catch(() => undefined);
  return key;
};

/** Encrypts secrets with a fresh random initialisation vector per write. */
export const encryptSecrets = (secrets: Secrets, key: Buffer): SecretEnvelope => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(secrets), "utf8"),
    cipher.final(),
  ]);

  return {
    version: 1,
    algo: ALGORITHM,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  };
};

/** Decrypts and verifies the auth tag. Throws when the tag or key is wrong. */
export const decryptSecrets = (envelope: SecretEnvelope, key: Buffer): Secrets => {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as Secrets;
};
