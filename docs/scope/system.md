# Epic: System

See and control what the server is doing: live metrics, a performance dashboard, processes, logs, and a terminal. This is the monitoring heart of the homelab.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | System metrics backend | Existing | existing |
| B | System usage widget | Existing | existing |
| C | Storage widget | Existing | existing |
| 12 | Performance dashboard | Slice 2 | planned |
| 13 | Process list & control | Slice 2 · GA | planned |
| 14 | Terminal | Slice 2 · GA | planned |
| 15 | Logs viewer | Slice 2 | planned |

## Existing

### A. System metrics backend · existing
Server functions expose CPU (total and per core), memory, disks, and network data from the real machine. code in `src/lib/storage.ts`, `src/hooks/use-system.ts`.

### B. System usage widget · existing
Live CPU and memory on the desktop, refreshed from the metrics backend. code in `src/components/widgets/system-usage.tsx`.

### C. Storage widget · existing
Connected disks with usage, split into internal and external or network drives. code in `src/components/widgets/storage.tsx`.

## Slice 2: Server management core

### 12. Performance dashboard · needs a decision
A dedicated view with history charts (CPU, memory, disk, network over time) instead of only live numbers, so you can see trends and spikes.

**Done when:** the dashboard shows current values and a time series for each metric, survives a reload, and stays responsive under frequent updates.
- [ ] Design it (spec): `/architect performance dashboard`

### 13. Process list & control · GA
List running processes with CPU and memory, search them, and stop one deliberately.

**Done when:** processes are listed and searchable, and killing a process asks for confirmation and refuses obviously protected targets.
- [ ] Develop it: `/develop process list & control`

### 14. Terminal · GA · needs a decision
An in browser shell into the server, so you can run commands without leaving the desktop. ChromeOS style: a tabbed terminal whose first tab is the host Linux shell, further tabs open a shell inside an available container, plus SSH connections and terminal settings.

**Done when:** a terminal session connects to the server, streams output, survives a resize, and closes cleanly; a tab can open a shell into a chosen container or an SSH connection; and appearance and shell settings persist.
- [ ] Design it (spec): `/architect terminal`

### 15. Logs viewer
Tail and search system and service logs in the browser.

**Done when:** you can pick a log source, follow it live, search it, and read older entries.
- [ ] Develop it: `/develop logs viewer`

## Deferred

- **Service (systemd) management**: start, stop, enable, and inspect services · needs a decision · GA
- **Scheduled tasks**: cron style jobs and timers · needs a decision · GA
- **Alerts & thresholds**: notify when a metric crosses a limit · needs a decision
