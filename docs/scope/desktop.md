# Epic: Desktop

The browser desktop itself: the wallpaper, taskbar, windows, widgets, and the shell that everything else opens into. This is the front door of opess, so it comes first and it has to feel like a real desktop.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Desktop shell | Existing | existing |
| B | Window manager | Existing | existing |
| C | Widget dock | Existing | existing |
| D | Apps registry & launcher | Existing | existing |
| E | Weather widget | Existing | in-progress |
| 5 | Persistent desktop state | Slice 1 | planned |
| 33 | Wallpaper library & upload | Later | planned |
| 34 | Widget catalog | Later | planned |
| 42 | System tray | Later | planned |
| 43 | Window tabs | Later | planned |

## Existing

### A. Desktop shell · existing
Wallpaper rendering, taskbar, right click context menu, and fullscreen control wrapped around the desktop. code in `src/routes/(container)/route.tsx`, `src/components/wallpapers/`.

### B. Window manager · existing
Open, close, focus, drag, resize, minimize, and maximize windows, with taskbar launch and z-order. code in `src/components/windows-manager/`.

### C. Widget dock · existing
Widgets live on the desktop, can be dragged and resized on large screens, and their layout is remembered. code in `src/components/widgets/widget-dock.tsx`, `src/hooks/use-widget-dock.ts`.

### D. Apps registry & launcher · existing
Apps are registered by hand and opened from the taskbar, with open and focus state reflected on the icons. code in `src/components/windows-manager/apps.tsx`.

### E. Weather widget · in-progress
The widget renders but its values are hardcoded, so it needs real weather data and a location. code in `src/components/widgets/weather.tsx`. Finish it via `/develop`. The other two widgets (system usage, storage) already use real data.

## Slice 1: Persistent desktop

### 5. Persistent desktop state · needs a decision
Open windows, their positions and sizes, the widget layout, and the active wallpaper all survive a reload and a server restart. Today windows live only in memory and reset on refresh, so nothing you arrange sticks. This is the thin thread that proves the persistence layer the whole product leans on.

**Done when:** reloading the page restores the exact desktop; a different browser on the same server shows the same saved state; missing or corrupt state falls back to defaults without an error.
- [ ] Design it (spec): `/architect persistent desktop state`

## Later

### 33. Wallpaper library & upload
Manage the wallpaper set and upload your own images instead of cycling a hardcoded list.
**Done when:** you can add, pick, and remove wallpapers, and uploaded images persist and render on the desktop.
- [ ] Develop it: `/develop wallpaper library & upload`

### 34. Widget catalog
Add, remove, and rearrange widgets from a catalog instead of a fixed set wired into the home route.
**Done when:** you can add a widget from a catalog, remove one, and the arrangement persists.
- [ ] Develop it: `/develop widget catalog`

### 42. System tray
A tray on the taskbar showing connection, volume, brightness, and quick toggles, so common state and controls are always within reach.

**Done when:** the tray reflects real state, opens a small panel of quick controls, and stays clear of the app icons on narrow screens.
- [ ] Design it (spec): `/architect system tray`

### 43. Window tabs
A tab strip on a window so several folders or documents share one window instead of opening many.

**Done when:** a window holds multiple tabs each with its own title and state, and tabs can be added, switched, and closed.
- [ ] Design it (spec): `/architect window tabs`

## Deferred

- **Window snapping & tiling**: snap windows to halves and corners, keyboard driven · needs a decision
- **Multiple desktops / workspaces**: separate named desktop spaces you switch between · needs a decision
