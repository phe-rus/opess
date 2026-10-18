import path from "node:path";
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { errorMessage, isNotFound } from "./guards";

/** Directories are owner only; files are owner read and write only. */
export const DIR_MODE = 0o700;
export const FILE_MODE = 0o600;

export const pathExists = async (file: string): Promise<boolean> => {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
};

/** Creates the config directory with an explicit mode, so `umask` cannot loosen it. */
export const ensureDir = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true, mode: DIR_MODE });
  await chmod(dir, DIR_MODE).catch(() => undefined);
};

/** Removes temp files left behind by an interrupted write. */
export const cleanStaleTemps = async (dir: string): Promise<void> => {
  try {
    const entries = await readdir(dir);
    await Promise.all(
      entries
        .filter((name) => name.endsWith(".tmp"))
        .map((name) => rm(path.join(dir, name), { force: true })),
    );
  } catch {
    // The directory does not exist yet; nothing to clean.
  }
};

export type JsonRead =
  | { state: "missing" }
  | { state: "ok"; value: unknown }
  | { state: "unreadable"; message: string };

/** Reads and parses a JSON file, distinguishing missing from unreadable. */
export const readJsonFile = async (file: string): Promise<JsonRead> => {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if (isNotFound(error)) return { state: "missing" };
    return { state: "unreadable", message: errorMessage(error) };
  }

  try {
    return { state: "ok", value: JSON.parse(raw) };
  } catch (error) {
    return { state: "unreadable", message: `Invalid JSON: ${errorMessage(error)}` };
  }
};

/**
 * Writes JSON atomically: build a temp file, keep the previous file as the last
 * good copy, then rename the temp over the target. A failed or interrupted
 * write leaves the previous good file readable (spec AC-3).
 */
export const writeJsonAtomic = async (file: string, value: unknown): Promise<void> => {
  const dir = path.dirname(file);
  await ensureDir(dir);

  const tmp = `${file}.tmp`;
  const data = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(tmp, data, { mode: FILE_MODE });
  await chmod(tmp, FILE_MODE).catch(() => undefined);

  // Keep the last good copy before swapping the new file in.
  if (await pathExists(file)) {
    await copyFile(file, `${file}.bak`).catch(() => undefined);
  }

  await rename(tmp, file);
};

/**
 * A per file, in process mutex. Serialises read, modify, write so two requests
 * cannot interleave a collection update. opess assumes a single process per
 * config directory (spec key invariants).
 */
const chains = new Map<string, Promise<void>>();

export const withFileLock = <T>(file: string, task: () => Promise<T>): Promise<T> => {
  const previous = chains.get(file) ?? Promise.resolve();
  // Run the task whether the previous holder resolved or rejected.
  const run = previous.then(task, task);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  chains.set(file, settled);
  void settled.then(() => {
    // Drop the entry once this chain is the tail again, so the map stays small.
    if (chains.get(file) === settled) chains.delete(file);
  });
  return run;
};
