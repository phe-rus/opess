# 0001. Data & config store for opess

**Date**: 2026-10-14
**Status**: Accepted

## Summary

opess needs one durable place for its own state: settings, the owner's desktop layout, the list of installed apps, and the account with its secrets. This decision keeps that state as human readable JSON files in one known config directory, written atomically, with only the secrets encrypted. It gives every later feature a single, simple read and write path that survives a reload, and it is the first thread of the persistent desktop work.

## Requirements

**User stories**:
- As the server owner, I want my settings, desktop layout, and installed apps to survive a reload and a restart, so that opess feels like a real desktop and not a demo.
- As the server owner, I want to find and copy my opess state as plain files, so that I can back it up and inspect it without special tools.
- As the server owner, I want my credentials protected if the config directory is copied, so that a leaked file alone does not hand over my server.
- As the developer, I want one store interface for all state, so that later features read and write through one path instead of inventing their own.

**Acceptance criteria** (the contract):

- **AC-1**: On a machine with no config directory, opess creates the directory and seeds default files, and reads succeed against the defaults.
- **AC-2**: A value written through the store API is present on disk and returned by the next read, including after the server restarts.
- **AC-3**: Every write builds a temporary file and renames it over the target; a failed or interrupted write leaves the previous good file readable, and a last good copy is kept.
- **AC-4**: A corrupt or unreadable collection loads defaults in memory, surfaces a clear warning, and is not overwritten on disk.
- **AC-5**: The secrets file contains no plaintext secret; decrypting it with the host key returns the original value, and without the key the secrets cannot be read.
- **AC-6**: A collection written at an older schema version is migrated forward on load; a migration that fails aborts, leaves the original file unchanged, and surfaces an error.
- **AC-7**: An unknown settings key is rejected on write with a clear error; an unknown key already on disk is preserved and ignored on read.
- **AC-8**: All collections live under one config directory whose path is resolved from configuration and can be read by the app.
- **AC-9**: The browser never reads or writes files directly; all state access goes through server functions, and no client module imports the server only store.

## Decision

**Chosen option**: Option 1: Human readable JSON files in a known config directory.

The store is a directory of JSON files, one per collection, each versioned, validated, and written atomically, with a separate encrypted file for secrets and a key file on the host.

## Feature design

**Data model sketch**:

Config directory (default `~/.config/opess`), one JSON file per collection. Each file is `{ "version": <int>, "<name>": <payload> }`. Directory mode 0700, file mode 0600, JSON pretty printed with a trailing newline.

- `settings.json`: `version`, `settings` (a map of namespaced key to value, for example `appearance.theme`). Known keys, types, and defaults live in one settings schema registry in the store module; defaults are applied on read and the file is seeded with an empty map.
- `account.json`: `version`, `account` (one record: `id`, `displayName`, `createdAt`, `passwordUpdatedAt`). Bootstrap seeds `id` from `crypto.randomUUID()`, `displayName` `Owner`, `passwordUpdatedAt` as null; `id` is immutable and is both the desktop map key and the later auth subject. Identity only, no secret material.
- `desktop.json`: `version`, `desktops` (a map of account id to a desktop document). Default document `{ windows: [], widgets: [], wallpaper: null, updatedAt: null }`. Window and widget entries are opaque to the store; only the top level types are validated. One entry today; the map keeps room for more accounts.
- `apps.json`: `version`, `apps` (array of `{ id, kind: container | plugin, source, version, enabled, config, installedAt }`), seeded as an empty array.
- `secrets.enc`: a JSON envelope `{ version, algo: "aes-256-gcm", iv, tag, data }` (base64, a 12 byte initialisation vector and a 16 byte auth tag) whose plaintext is `{ credentials: { passwordHash, passkeys: [], recoveryCodes: [] }, serviceTokens: {} }`. A fresh random initialisation vector is used per write and the auth tag is verified on decrypt.
- `secret.key`: the encryption key, 32 random bytes, owner read only (mode 0600), kept separate from `secrets.enc` so a copy of the encrypted file alone is useless. It is generated only when both the key and `secrets.enc` are absent; if `secrets.enc` exists without the key, reads fail with `keyMissing` and the key is never regenerated.

**Atomic write**: write `<file>.tmp` in the same directory, then rename it over the target, and keep `<file>.bak` as the last good copy. A per file in memory mutex serialises read, modify, write, and stale temp files are cleaned at startup. File modes are set explicitly on write so a permissive `umask` cannot loosen them.

**API surface** (server functions, consumed with TanStack Query):

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `getSettings` | query | none | settings map with defaults applied | none (gap) | `storeUnreadable` |
| `updateSettings` | mutation | `patch: Record<string, unknown>` (req) | updated settings map | none (gap) | `invalidKey`, `writeFailed` |
| `getDesktop` | query | none | desktop document for the account | none (gap) | `storeUnreadable` |
| `updateDesktop` | mutation | `document` (req) | saved document | none (gap) | `invalidDocument`, `writeFailed` |
| `listApps` | query | none | app records | none (gap) | `storeUnreadable` |
| `upsertApp` | mutation | `record` (req) | app records | none (gap) | `invalidRecord`, `writeFailed` |
| `removeApp` | mutation | `id: string` (req) | app records | none (gap) | `notFound`, `writeFailed` |
| `getAccount` | query | none | account record, no secrets | none (gap) | `storeUnreadable` |
| `getConfigLocation` | query | none | resolved config path | none (gap) | none |
| `readSecrets` / `writeSecrets` | server only | `key`, `value` | secret value | internal | `keyMissing`, `writeFailed` |

`readSecrets` and `writeSecrets` are server only and are never exposed as client callable functions. The auth feature (#27) is their consumer; the browser only ever sees the non secret account record.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Bootstrap the account | the owner account id | `crypto.randomUUID()` at first run |
| Read a setting | the setting value | `settings.json` entry, else the settings schema registry default |
| Read the desktop | desktop document | `desktop.json` `desktops[accountId]` |
| Resolve the account id | account id | `account.json` `account.id` |
| Resolve the config directory | the path | `OPESS_CONFIG_DIR`, else the default path |
| Decrypt a secret | plaintext secret | `secrets.enc` decrypted with `secret.key` |
| Migrate a collection | target schema version | the current schema version in code |
| Show the config location | the path in Settings | the resolved config directory |
| List installed apps | app records | `apps.json` `apps` |

**Key invariants**:
- Every collection file is valid JSON with an integer `version`.
- Every write is atomic (temporary file, then rename); no write happens in place.
- Secrets are never written outside `secrets.enc`, and `secrets.enc` is never written unencrypted.
- Secret crypto uses AES-256-GCM with a fresh random initialisation vector per write, and the auth tag is verified on decrypt.
- The key file is stored separately from the encrypted secrets file and is never regenerated while `secrets.enc` exists.
- The config directory is mode 0700 and its files are mode 0600, set explicitly on write.
- One writer per file, serialised by an in process mutex; opess assumes a single process per config directory.
- Unknown keys are rejected on write and preserved on read.
- Migrations are pure and idempotent, so a migration whose write fails simply re-runs on the next load.

**Security model**:
- The store runs on the server only. The browser reaches it through server functions and never touches disk. No client module imports the server store.
- Until the sign in feature (#27) lands, the store functions are unauthenticated: anything that can reach the opess port can read and write all state. This is an accepted, documented gap on a trusted home network. If opess is exposed beyond the LAN, build #27 first.
- Secrets are encrypted at rest with AES-256-GCM and a key held in a 0600 file on the host. This protects a copied config directory, not a host that is already compromised. The key is never regenerated while `secrets.enc` exists, so a missing key is a hard error rather than silent data loss. Password hashing itself is the auth feature's concern; the store only holds the encrypted blob.
- No secrets are written into `account.json`, logs, or error messages.

**Configuration required**:
- `OPESS_CONFIG_DIR`: the store directory (default `<home>/.config/opess`, resolved without `~` expansion).
- `OPESS_SECRET_KEY_FILE`: path to the encryption key file (default `<OPESS_CONFIG_DIR>/secret.key`).

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path: change a setting through the UI and reload the page; the value persists, verifies **AC-2**.
- Failure case: make the target file read only, or simulate a full disk, then write; the previous file stays readable, verifies **AC-3**.
- Failure case: corrupt `desktop.json`; opess loads defaults with a warning and leaves the file untouched, verifies **AC-4**.
- Security: inspect `secrets.enc` for plaintext and try to decrypt without the key; neither succeeds, verifies **AC-5**.
- Security: remove `secret.key` while `secrets.enc` exists; a read fails with `keyMissing` and the key is not regenerated, verifies **AC-5**.
- Migration: load a version 1 file against a version 2 schema (migrates and persists the bumped version), then a throwing migration (aborts, file unchanged), verifies **AC-6**.
- First run: start with no config directory; defaults are seeded and reads succeed, verifies **AC-1**.

## Build plan

Tracer Bullet: prove one real write through every layer first, then thicken the same thread.

1. Resolve the config directory from configuration, create it (mode 0700), and seed the default collection files (an empty settings map, a bootstrapped account id, an empty apps array, a default desktop). satisfies **AC-1**, **AC-8**
2. Build the core collection primitive: read JSON with its schema version, validate against the schema, write atomically with the last good copy, explicit modes, and a per file mutex, and clean stale temp files at startup. satisfies **AC-3**, **AC-7**
3. Wire the thin end to end thread: `settings.json` read and write through a server function and a TanStack Query hook, with the settings schema registry and defaults applied on read, so one setting changed in the UI persists. satisfies **AC-2**, **AC-9**
4. Add corruption handling: on unreadable or invalid JSON, load defaults in memory, log a structured warning, expose it on the read result, and do not overwrite. satisfies **AC-4**
5. Add the desktop document collection and its read and write path, keyed by the account id. satisfies **AC-2**
6. Add the installed apps collection and its read and write path. satisfies **AC-2**
7. Add the account record read and the encrypted secrets area: an AES-256-GCM envelope with a fresh initialisation vector, a key file lifecycle that never regenerates a missing key, and the server only `readSecrets` and `writeSecrets`. satisfies **AC-5**
8. Add the migrations registry and run pure forward migrations on load, persisting the bumped version on success and aborting on failure. satisfies **AC-6**
9. Surface the resolved config location for the Settings app to read. satisfies **AC-8**
10. Add tests covering the store primitive, the round trip, and the crypto envelope.

## Consequences

**Positive**:
- One read and write path for all opess state, so settings, desktop, apps, and later auth all share it.
- State is human readable and easy to back up, inspect, and move by hand.
- No heavy dependency and no native build step, which suits a solo project and plenty of target machines.
- Desktop state leaves memory and `localStorage`, which unblocks the persistent desktop slice.

**Negative / tradeoffs**:
- Schema validation, migrations, and atomic writes are hand rolled, so they carry their own test burden.
- Whole document writes rewrite the file each time; fine at this size, wasteful if the data grows large.
- No querying, so any future feature that needs to filter or aggregate state will want a database.
- There is no transaction across files, so a crash during a multi file update can leave partial progress on disk.
- In process locking assumes one opess process per config directory; two processes sharing a directory would race.
- Losing `secret.key` makes the secrets unrecoverable, so the backup feature must include it.
- The store is unauthenticated until sign in (#27) lands, so exposure beyond the LAN is unsafe in the meantime.

**Neutral**:
- A new convention: all persistent state goes through the store's server functions, never direct file access from the client.
- The config directory must exist and be writable by the opess process.
- The account id is generated at first run and is immutable; the desktop map and later auth both depend on it.
- Migrations must stay pure, since a migration whose write fails simply re-runs on the next load.
- Backups must handle the key file explicitly so secrets are not exported in the clear.

## Rationale

Reasoning and the options weighed: see [rationale.md](./rationale.md).

## Follow-up

- [ ] The store is unauthenticated until sign in (#27). Build #27 before or with this store if opess will be reachable beyond the local network.
- [ ] The backup and restore feature (#31) must decide how `secrets.enc` and `secret.key` are exported together, so a portable export does not leak secrets and a missing key is covered.
- [ ] Revisit the JSON file choice if opess ever needs to query state or store large data; SQLite is the documented fallback at that point.
