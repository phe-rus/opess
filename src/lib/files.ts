import os from "node:os";
import path from "node:path";
import { open, readdir, realpath, stat } from "node:fs/promises";

/** Maximum number of entries a single directory listing will return. */
const MAX_ENTRIES = 1000;
/** Maximum bytes read for a file preview. */
const MAX_PREVIEW_BYTES = 512 * 1024;

export type FileEntry = {
    name: string;
    path: string;
    isDirectory: boolean;
    isSymlink: boolean;
    /** Size in bytes (0 for directories). */
    size: number;
    /** Modification time in epoch milliseconds (0 when unknown). */
    mtimeMs: number;
};

export type DirectoryListing = {
    /** Fully resolved path being listed. */
    path: string;
    /** The user's home directory, used for the "~" alias in the path bar. */
    home: string;
    /** Parent directory, or null when already at the root. */
    parent: string | null;
    /** Set when the directory could not be read (permissions, races, ...). */
    error: string | null;
    /** True when the directory holds more entries than MAX_ENTRIES. */
    truncated: boolean;
    entries: FileEntry[];
};

export type FilePreview = {
    path: string;
    name: string;
    /** Decoded text content, or null for binary files and folders. */
    content: string | null;
    isBinary: boolean;
    /** True when the file is larger than the preview limit. */
    truncated: boolean;
    size: number;
    error: string | null;
};

/**
 * Resolves a client-supplied path. Empty input (and "~") mean the home
 * directory; everything else must be an absolute path.
 */
const resolveInput = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed || trimmed === "~") return os.homedir();
    if (trimmed.startsWith("~/")) return path.join(os.homedir(), trimmed.slice(2));
    return path.resolve(trimmed);
};

const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

export const ListDirectory = async (input: string): Promise<DirectoryListing> => {
    const home = os.homedir();
    const dir = resolveInput(input);

    try {
        const resolved = await realpath(dir);
        const parent = path.dirname(resolved);
        const dirents = await readdir(resolved, { withFileTypes: true });

        const entries = await Promise.all(
            dirents.slice(0, MAX_ENTRIES).map(async (dirent) => {
                const full = path.join(resolved, dirent.name);
                // stat() follows symlinks, so a link to a folder lists as a folder.
                const stats = await stat(full).catch(() => null);
                const isDirectory = stats?.isDirectory() ?? dirent.isDirectory();
                return {
                    name: dirent.name,
                    path: full,
                    isDirectory,
                    isSymlink: dirent.isSymbolicLink(),
                    size: isDirectory ? 0 : (stats?.size ?? 0),
                    mtimeMs: stats?.mtimeMs ?? 0,
                } satisfies FileEntry;
            }),
        );

        return {
            path: resolved,
            home,
            parent: parent === resolved ? null : parent,
            error: null,
            truncated: dirents.length > MAX_ENTRIES,
            entries,
        };
    } catch (error) {
        return {
            path: dir,
            home,
            parent: path.dirname(dir) === dir ? null : path.dirname(dir),
            error: errorMessage(error),
            truncated: false,
            entries: [],
        };
    }
};

export const ReadTextFile = async (input: string): Promise<FilePreview> => {
    const full = resolveInput(input);
    const name = path.basename(full);

    try {
        const stats = await stat(full);
        if (stats.isDirectory()) {
            return { path: full, name, content: null, isBinary: false, truncated: false, size: 0, error: "This is a folder." };
        }

        const handle = await open(full, "r");
        try {
            const buffer = Buffer.alloc(MAX_PREVIEW_BYTES + 1);
            const { bytesRead } = await handle.read(buffer, 0, MAX_PREVIEW_BYTES + 1, 0);
            const slice = buffer.subarray(0, bytesRead);
            const isBinary = slice.includes(0);

            return {
                path: full,
                name,
                content: isBinary ? null : slice.toString("utf8"),
                isBinary,
                truncated: stats.size > MAX_PREVIEW_BYTES,
                size: stats.size,
                error: null,
            };
        } finally {
            await handle.close();
        }
    } catch (error) {
        return {
            path: full,
            name,
            content: null,
            isBinary: false,
            truncated: false,
            size: 0,
            error: errorMessage(error),
        };
    }
};
