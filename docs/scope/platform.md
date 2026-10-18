# Epic: Platform

The cross cutting foundations every other epic stands on: persistent configuration, localization, accessibility, the mobile companion, and shared UI like notifications.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Design system & UI kit | Existing | existing |
| 1 | Data & config store | Foundation | done |
| 2 | Internationalization | Foundation | planned |
| 3 | Accessibility baseline | Foundation | planned |
| 4 | Mobile companion shell | Foundation | planned |
| 38 | Local hostname & discovery | Foundation | planned |
| 35 | Notifications & toasts | Later | planned |
| 36 | Local error reporting | Later | planned |
| 37 | Command palette & shortcuts | Later | planned |

## Existing

### A. Design system & UI kit · existing
shadcn style components in `src/components/ui/`, themed with Tailwind v4 CSS variables and Hugeicons. code in `src/components/ui/`, `src/globals.css`.

## Foundation

### 1. Data & config store · done
Decide where opess keeps durable state (config, the owner account, desktop state, installed apps) and how code reads and writes it. Every later slice depends on this, so it is the first thing to settle. This is the decision behind persistent desktop state.

**Done when:** a shared store is recorded in a spec, one real read and write path runs end to end, and the choice supports later slices (sign in, settings, backups) without a breaking rework.
spec [0001](../specs/0001-data-config-store/index.md) · code in `src/lib/store/`, `src/hooks/use-store.ts`
- [x] Design it (spec): `/architect data & config store`
- [x] Build it: `/develop data & config store`
  - [x] Store primitive and config directory: resolve, create, seed, atomic write, last good copy, mutex (AC-1, AC-3, AC-7, AC-8)
  - [x] Settings round trip end to end through a server function and hook, with the schema registry (AC-2, AC-9)
  - [x] Corruption handling: load defaults, warn, do not overwrite (AC-4)
  - [x] Desktop and apps collections, keyed by the account id (AC-2)
  - [x] Account, encrypted secrets, migrations, and config location (AC-5, AC-6, AC-8)
- [x] Verify it: `/check verify data & config store`
- [x] Test it: `/test data & config store`

### 2. Internationalization · needs a decision
A locale layer and at least one extra language, so the whole UI can be translated and follows the user's locale.

**Done when:** user facing strings come from a locale resource, the language can be switched, and the choice persists.
- [ ] Design it (spec): `/architect internationalization`

### 3. Accessibility baseline
Keyboard use, focus states, real labels, and contrast on core flows, aiming for WCAG AA where it is cheap.

**Done when:** every core flow is fully keyboard reachable, focus is visible, and interactive elements have accessible names.
- [ ] Develop it: `/develop accessibility baseline`

### 4. Mobile companion shell
A touch friendly layout so the whole server can be managed from a phone, with the desktop layout staying primary on large screens.

**Done when:** every core flow works on a phone width and by touch, and the desktop layout is unchanged on large screens.
- [ ] Develop it: `/develop mobile companion shell`

### 38. Local hostname & discovery · needs a decision
Reach opess by a stable local name instead of a raw IP that can change, so a bookmark and a certificate stay valid and the URL is easy to remember. The mechanism (local name resolution or discovery on the LAN) is the decision.

**Done when:** opess is reachable by a fixed name on the local network without knowing its IP, the name survives a DHCP address change, and it resolves on the common devices you use.
- [ ] Design it (spec): `/architect local hostname & discovery`

## Later

### 35. Notifications & toasts
A single place for app and system notifications, so actions (an upload finishing, a container stopping) can report back.

**Done when:** any feature can raise a notification, several stack cleanly, and they dismiss or expire on their own.
- [ ] Develop it: `/develop notifications & toasts`

### 36. Local error reporting
Catch and surface errors in the UI with enough detail to debug, stored locally with nothing sent off the machine.

**Done when:** an unexpected error shows a clear message and can copy its details, and the server stays up.
- [ ] Develop it: `/develop local error reporting`

### 37. Command palette & shortcuts
A keyboard palette to jump to apps, settings, and actions, plus a shortcut layer, so opess is fast to drive.

**Done when:** the palette opens by shortcut, searches apps and actions, and runs the chosen one.
- [ ] Develop it: `/develop command palette & shortcuts`

## Deferred

- **Custom themes**: user made themes beyond light and dark · needs a decision
- **Plugin based theming**: themes shipped as plugins · needs a decision
