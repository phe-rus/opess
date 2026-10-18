# Epic: Apps & containers

Run and manage apps on the server as containers, the CasaOS style core: see what is running, install curated apps, and manage multi container stacks.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 16 | Container manager | Slice 3 · GA | planned |
| 17 | Container app catalog | Slice 3 | planned |
| 18 | Compose stacks | Slice 3 | planned |
| 19 | Container resource monitoring | Slice 3 | planned |

## Slice 3: Apps & containers

### 16. Container manager · GA · needs a decision
List containers with state, and start, stop, restart, and remove them, read a container's logs, and browse a container's filesystem in the file manager.

**Done when:** containers are listed with live state, each action works against the runtime, logs stream, and a destructive action confirms first.
- [ ] Design it (spec): `/architect container manager`

### 17. Container app catalog · needs a decision
Install well known self hosted apps from a curated catalog in a few clicks, with the settings each app needs.

**Done when:** you can browse a catalog, install an app, see it come up, and uninstall it, without editing config on the server by hand.
- [ ] Design it (spec): `/architect container app catalog`

### 18. Compose stacks
Group several containers into one named stack you start and stop together.

**Done when:** a stack of multiple services can be defined, started, stopped, and removed as a unit.
- [ ] Develop it: `/develop compose stacks`

### 19. Container resource monitoring
Per container CPU, memory, and network, so you can see which app is heavy.

**Done when:** each running container shows live resource use and the values update without a manual refresh.
- [ ] Develop it: `/develop container resource monitoring`

## Deferred

- **Kubernetes support**: manage a cluster instead of a single docker host · needs a decision
- **GPU / accelerator management**: see and assign GPUs to apps · needs a decision
