# Epic: Extensions & app store

Make opess extensible: a plugin system other people can build against, and a store to browse and install plugins, the piece that lets the community grow it.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 23 | Plugin system & SDK | Slice 5 | planned |
| 24 | App & plugin store | Slice 5 | planned |
| 25 | Plugin permissions & sandbox | Slice 5 · GA | planned |
| 26 | Plugin developer docs & template | Slice 5 | planned |

## Slice 5: Extensions & app store

### 23. Plugin system & SDK · needs a decision
Define what a plugin is and how it wires into opess (registers apps, widgets, panels, or settings), with a stable interface. This is the architectural center of the product.

**Done when:** a plugin can be written against a documented interface, loaded by opess, and show up as an app or widget without changing core code.
- [ ] Design it (spec): `/architect plugin system & SDK`

### 24. App & plugin store · needs a decision
Browse, install, update, and remove plugins from a store, so extending opess needs no terminal.

**Done when:** a store lists available plugins with detail, installs one, shows it running, and updates or removes it cleanly.
- [ ] Design it (spec): `/architect app & plugin store`

### 25. Plugin permissions & sandbox · GA
Plugins declare what they need and are limited to it, so an installed plugin cannot quietly take over the server.

**Done when:** a plugin's requested capabilities are shown before install and enforced at runtime, and a plugin cannot exceed what it declared.
- [ ] Develop it: `/develop plugin permissions & sandbox`

### 26. Plugin developer docs & template
A starter template and written guide so others can build and publish a plugin.

**Done when:** a developer can scaffold a plugin from the template and follow the docs to a working, installable extension.
- [ ] Develop it: `/develop plugin developer docs & template`
