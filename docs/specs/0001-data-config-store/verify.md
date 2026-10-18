# Verify: data & config store · spec 0001 · updated 2026-10-14

_Steps derived from spec 0001 acceptance criteria and the Value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

_Run 2026-10-14 via `/check verify`: the command steps ran against the store harness and the live dev server (server functions over HTTP plus the SSR page). The UI steps were not driven (no browser automation available) and remain unticked._

## UI / manual

- [ ] Fresh machine (no config dir): start opess, open **Settings → Data** → the config dir and key file paths show, reads succeed, and the dir holds `settings.json`, `account.json`, `desktop.json`, `apps.json` with default contents → AC-1, AC-8
- [ ] Open **Settings → Appearance**, pick **Dark** → the desktop turns dark; reload the page → it is still dark (the value persisted through the store) → AC-2
- [ ] Pick **Light**, reload → still light; pick **System**, reload → follows the OS preference → AC-2
- [ ] Open **Settings → Data** → the shown config path matches `$OPESS_CONFIG_DIR` (or `~/.config/opess`) and the key file matches `$OPESS_SECRET_KEY_FILE` (or `<configDir>/secret.key`) → AC-8
- [ ] Stop opess, put invalid JSON in `desktop.json`, start opess, open **Settings → Data** → a warning is shown; the desktop state loads as the default document and `desktop.json` on disk is unchanged → AC-4
- [ ] Edit `settings.json` by hand and add an unknown key (for example `"legacy.unknown": 1`), reload → opess still loads, ignores it, and a later setting change leaves it on disk → AC-7

## Commands

- [x] `bunx tsc --noEmit` → passes with no errors → AC-9
- [x] `bun --bun run build` → client and server build succeed; the store appears only in the server bundle → AC-9
- [ ] `bun test` → the store test suite passes → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
- [x] `ls -la ~/.config/opess` (or `$OPESS_CONFIG_DIR`) → directory is `drwx------` (0700) and every file is `-rw-------` (0600) → AC-3, AC-8
- [x] `grep -c "passwordHash\|passkeys" ~/.config/opess/secrets.enc` → no plaintext match; the file is a `{ version, algo, iv, tag, data }` envelope → AC-5
- [x] Delete `secret.key` while `secrets.enc` exists, then read secrets → fails with `keyMissing` and the key is not regenerated → AC-5

## Acceptance-criteria coverage

- AC-1 first run seeds defaults → UI step 1 · command 3
- AC-2 write then read persists, survives restart → UI steps 2 and 3 · command 3
- AC-3 atomic write, last good copy, explicit modes → command 3 (`settings.json.bak`) and command 4
- AC-4 corrupt collection loads defaults, warns, not overwritten → UI step 5 · command 3
- AC-5 secrets encrypted, key missing is a hard error → command 5 and command 6
- AC-6 migrations forward on load, abort unchanged on failure → command 3
- AC-7 unknown key rejected on write, preserved on read → UI step 6 · command 3
- AC-8 one config dir, path resolved from configuration → UI step 1 and step 4 · command 4
- AC-9 browser never touches disk; store is server only → command 1 and command 2
