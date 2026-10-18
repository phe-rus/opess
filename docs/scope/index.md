# Scope: opess

opess is a self hosted homelab OS that runs in the browser. It turns a server into a desktop you manage from any device: apps, files, disks, network, and containers in one place.

**Build approach:** Tracer Bullet (prove the whole pipe end to end, then thicken it one strand at a time).
**Workflow:** Beta (after `/develop`: `/check verify`, then `/test`). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· GA`, `· Prototype`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| Epic | File | Phase | Status |
|------|------|-------|--------|
| Desktop | [desktop.md](./desktop.md) | Slice 1 | 4 existing · 1 in-progress · 5 planned · 2 deferred |
| Files & storage | [files-storage.md](./files-storage.md) | Slice 2 | 1 existing · 9 planned · 2 deferred |
| System | [system.md](./system.md) | Slice 2 | 3 existing · 4 planned · 3 deferred |
| Apps & containers | [apps-containers.md](./apps-containers.md) | Slice 3 | 4 planned · 2 deferred |
| Network & devices | [network-devices.md](./network-devices.md) | Slice 4 | 1 existing · 1 in-progress · 2 planned · 5 deferred |
| Extensions & app store | [extensions.md](./extensions.md) | Slice 5 | 4 planned |
| Server administration | [server-admin.md](./server-admin.md) | Slice 6 | 1 existing · 6 planned · 3 deferred |
| Platform | [platform.md](./platform.md) | Foundation | 1 existing · 1 in-progress · 7 planned · 2 deferred |

## How to read it

Each epic file holds its own At a glance table and its feature sections grouped by phase, in build order. A feature with `needs a decision` runs `/architect` first; every other planned feature goes straight to `/develop`. Features labeled with a letter (`A`, `B`, …) are already built (enrolled for context, status `existing`), so `/develop` and `/sync` leave them alone.

## Legend

**The decision box.** Every planned feature carries exactly one box whose label ends with `(spec)`. Its wording varies, so skills find it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: a feature moves `planned` → `in-progress` → `done`. `existing` means it predates the workflow; `dropped` means de-scoped but kept for history.

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop`. The tag drops once the spec is captured.
- **Workflow tier** tag beside a heading (e.g. `· GA`, `· Prototype`) sets that one feature's rigor above or below the Beta default. High blast radius features (disk format and eject, process control, container management, network control, auth, plugin sandbox) are tagged `· GA`.
- **Pointer line** (`spec <n> · code in <path>`) appears only once the spec or code exists.
