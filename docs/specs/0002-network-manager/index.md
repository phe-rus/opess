# 0002. Manage the host network from opess

**Date**: 2026-10-15
**Status**: In Progress

## Summary

opess can see the server's network but cannot change it. This decision makes it able to, by writing the same netplan files the machine already uses and applying them through systemd-networkd. Every change goes through a safety window: if a change would cut the connection you are using, it is reverted automatically unless you confirm that it still works. Wifi joins are driven through wpa_supplicant (the program that handles wireless authentication), and a passphrase is never read back.

## Requirements

**User stories**:
- As the server owner, I want to join a wifi network from the desktop, so that I do not need a terminal on the machine.
- As the server owner, I want to set an interface to a static address or change its DNS, so that the server keeps a stable address on my network.
- As the server owner, I want a bad change to undo itself, so that I cannot lock myself out of the server.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: The Network section lists every interface with its type, link state, address, MAC, gateway, DNS, and whether it uses DHCP or a static address, read from the live host.
- **AC-2**: Nearby wifi networks are listed with SSID, signal strength, and security, and the connected network is marked.
- **AC-3**: Joining a wifi network with a passphrase applies, and the join survives a reboot (it is persisted in netplan).
- **AC-4**: Leaving a wifi network disconnects it and returns the interface to a disconnected state, persisted.
- **AC-5**: Switching an interface between DHCP and static, or editing its address, gateway, or DNS, applies to the real netplan config and survives a reboot.
- **AC-6**: A change that would break the connection in use is reverted automatically unless the user confirms within the confirmation window, so a bad change cannot lock the user out.
- **AC-7**: Invalid input is rejected before any config is written (a bad CIDR address, an unknown interface, a missing passphrase), with a clear error and no change to the host.
- **AC-8**: Every write validates the config with `netplan generate` before `netplan apply`, and a failed validation leaves the previous config in place, unchanged.
- **AC-9**: No read ever returns a wifi passphrase. The only places a passphrase lands on disk are the netplan file and the wpa_supplicant config netplan generates from it, both kept at file mode 0600.

## Decision

**Chosen option**: Option 1, drive netplan and systemd-networkd, with wpa_supplicant for wifi.

opess reads and writes the netplan YAML in `/etc/netplan/`, validates with `netplan generate`, applies with `netplan apply`, and takes its live readings from `networkctl` (with `wpa_cli` for scanning). Wifi is configured through netplan access points, which netplan hands to wpa_supplicant. This is the layer the machine already runs, so opess changes the network the same way the board's own tooling does, with no second network daemon.

**Implementation skills**: none.

## Feature design

**Data model sketch**: No new opess entity, because the source of truth is the host's netplan YAML under `/etc/netplan/`. opess keeps two small pieces of its own state under the opess config directory (`OPESS_CONFIG_DIR`, default `/root/.config/opess`, directory mode 0700, files mode 0600):
- `network/backups/<timestamp>/`: a copy of the netplan directory taken before each write, used to revert.
- `network/pending.json`: one record `{ id, createdAt, expiresAt, interface, summary, backupPath }` describing a change that is applied and awaiting confirmation, or `null` when none is pending.

**State transitions** (the pending change is the only state machine):
- none, then a write stages and applies the config and moves to **pending** with an `expiresAt`.
- pending, then the user confirms, moves to **confirmed**: the change is kept and the snapshot is pruned.
- pending, then the user reverts or the window expires, moves to **reverted**: the snapshot is restored and applied, returning the previous config.
- At most one change is pending at a time.

**API surface**: server functions, the project convention (a server only module wrapped in `createServerFn`), read through the exported TanStack Query options. Read actions are GET, write actions are POST.

| Server function | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `getNetworkInfo` (extended) | GET | none | interfaces with type, link state, address, gateway, DNS, DHCP or static; connected SSID | none today | read failure |
| `getNetworkConfig` | GET | none | the resolved netplan config with every credential field masked | none today | netplan unavailable |
| `scanWifi` | GET | interface | networks: SSID, signal, security, connected flag | none today | interface busy or not wifi |
| `connectWifi` | POST | interface, SSID, passphrase | pending change id, expiresAt | none today | unknown SSID, join failed |
| `disconnectWifi` | POST | interface | pending change id, expiresAt | none today | interface not wifi |
| `applyInterfaceConfig` | POST | interface, mode (dhcp or static), address, gateway, DNS | pending change id, expiresAt | none today | invalid CIDR, unknown interface |
| `getPendingNetworkChange` | GET | none | pending change or null | none today | none |
| `confirmNetworkChange` | POST | id | kept config | none today | expired or unknown id |
| `revertNetworkChange` | POST | id | restored config | none today | unknown id |

**Value sourcing** (every value each action produces or displays names its source):
| Action | Value produced / displayed | Source |
|---|---|---|
| Interface list | kind (ethernet, wifi, or other) | `networkctl --json=short list`, the `Type` field (`ether`, `wlan`, `bridge`), mapped to a kind |
| Interface list | link state | `networkctl --json=short list`, the `OperationalState` field (for example `routable`, `no-carrier`, `carrier`) |
| Interface list | address and gateway | the existing `GetNetworkInfo` read path (`systeminformation`) |
| Interface list | per link DNS | `networkctl --json=short list`, the `DNS` field (the global list from `/etc/resolv.conf` stays as the section level fallback) |
| Interface list | DHCP or static | netplan's rendered network file for the link: the `NetworkFile` path networkctl reports (`/run/systemd/network/10-netplan-*.network`), where `DHCP=` means DHCP and a bare `Address=` means static; falls back to the live address `ConfigSource` when no file is found |
| Interface list | connected SSID | `networkctl --json=short list`, the `SSID` field |
| Wifi scan | SSID, signal, security | `wpa_cli -i <interface> scan_results`, through the wpa_supplicant instance netplan already runs for the link (the generated config sets `ctrl_interface=/run/wpa_supplicant`); `iw dev <interface> scan` is the runner up |
| Wifi scan | connected flag | networkctl's `SSID` for the link compared with the scan results |
| `connectWifi` | passphrase | the POST input; written into the netplan file, from which netplan generates the wpa_supplicant config, and never returned by any read |
| Any write | the confirmation window length | `OPESS_NETWORK_CONFIRM_TIMEOUT` (default 120 seconds) |
| Any write | the snapshot to restore | `OPESS_NETWORK_BACKUP_DIR` |
| Revert | whether a change is still pending | `network/pending.json` |

**Key invariants**:
- No netplan file is written unless `netplan generate` succeeds on the staged config.
- Every write snapshots the current config before it touches the live files.
- A read never returns a passphrase.
- `getNetworkConfig` masks every credential field (`password`, `psk`, and `passphrase`, and anything under an `auth:` block) at every depth before returning, so the config can be shown without leaking the key.
- At most one pending change exists at a time.
- Write actions are refused unless `OPESS_NETWORK_CONTROL` is enabled.

**Security model**: There is no sign in yet (scope feature 27 is planned), so any client that can reach the port can call these functions, which now include network takeover and wifi credential capture. This is the same exposure the rest of the app has today, but the blast radius is far larger. The write actions must be gated behind sign in or bound to loopback before this feature is called done. Until then it is not safe on an untrusted network, so `OPESS_NETWORK_CONTROL` defaults to off.

The passphrase is stored in clear text in three places on this host: `/etc/netplan/30-wifis-dhcp.yaml` and `/etc/netplan/armbian.yaml` (both mode 0600), and the wpa_supplicant config netplan generates at `/run/netplan/wpa-<interface>.conf` (mode 0600). `netplan get` merges those files and prints the passphrase, so `getNetworkConfig` must mask it and no read may pass a raw netplan or wpa_supplicant file through.

**Configuration required**:
- `OPESS_NETPLAN_DIR`: the netplan directory to read and write (default `/etc/netplan`).
- `OPESS_NETWORK_BACKUP_DIR`: where config snapshots are kept (default `<configDir>/network/backups`).
- `OPESS_NETWORK_CONFIRM_TIMEOUT`: seconds before an unconfirmed change reverts (default 120).
- `OPESS_NETWORK_CONTROL`: enables the write actions (default `off` until the auth gate lands).

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path: join a wifi network with a passphrase, it applies, and it survives a reboot, verifies **AC-3**.
- Failure case: apply a static address that is unreachable and never confirm, and the change reverts within the window with the previous config restored, verifies **AC-6**.
- Validation: submit an invalid CIDR or an unknown interface, and nothing is written while a clear error returns, verifies **AC-7**, **AC-8**.
- Security: read the interface list and the network config after joining a wifi network, and no passphrase appears, verifies **AC-9**.

## Build plan

The project delivers by Tracer Bullet, so the plan first proves one thin thread end to end through every layer (read, validate, snapshot, write, apply, revert), then thickens it surface by surface.

1. Extend the read path (server function plus the Settings display) with interface type, link state, DHCP or static, and the connected SSID, satisfying **AC-1**.
2. Stand up the write module end to end with one safe action, changing DNS on an interface that does not carry the opess connection: snapshot, stage, `netplan generate`, `netplan apply`, then the confirmation window with automatic revert, and add the masked config read (`getNetworkConfig`) that never returns a credential, satisfying **AC-5**, **AC-6**, **AC-8**, **AC-9**.
3. Add the wifi scan and the connected marker to the Settings Network section, satisfying **AC-2**.
4. Add wifi join and leave, writing netplan access points and persisting the result, never returning a passphrase on any read, satisfying **AC-3**, **AC-4**, **AC-9**.
5. Add interface addressing (DHCP and static) to the write module, satisfying **AC-5**.
6. Add input validation and error mapping to every write action, satisfying **AC-7**.

## Migration plan

This is an enhancement to a live system, so the write capability arrives alongside the read only panel rather than replacing it.

**Strategy**: strangler. The read only panel and the existing `GetNetworkInfo` read path stay live and unchanged in shape; the write capability is a new server only module beside them, behind `OPESS_NETWORK_CONTROL` (default off), so the app behaves exactly as it does today until the switch is turned on.

**Phases**:
1. Read model: extend `GetNetworkInfo` with type, link state, DHCP or static, and the connected SSID; the panel shows the richer state. No writes. (**AC-1**)
2. Control module, dry: add the netplan module, the masked `getNetworkConfig`, and the validation path, still with `OPESS_NETWORK_CONTROL` off, so the writer can be exercised without touching the live network. (**AC-8**, **AC-9**)
3. Control module, live on one safe action: enable the DNS change on an interface that does not carry the opess connection, plus the confirmation window. (**AC-5**, **AC-6**)
4. Wifi scan, join, and leave, then interface addressing, then the sign in gate before GA. (**AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-7**, **AC-9**)

**Rollback**: the change is additive. Setting `OPESS_NETWORK_CONTROL` back to `off` stops all writes and the panel returns to read only. A change already applied is reversed from `network/backups/<timestamp>/`. There is no store migration and no data backfill, so nothing else needs rolling back.

**Risks**:
- **Lockout**: mitigated by the confirmation window (**AC-6**) and by defaulting every write off.
- **Credential exposure**: mitigated by never returning a passphrase (**AC-9**) and keeping the netplan file at mode 0600.
- **Wrong interface targeted**: mitigated by rejecting unknown interfaces and validating with `netplan generate` (**AC-7**, **AC-8**).
- **Wireless disruption during a scan**: a scan is brief, and it is skipped on the interface carrying the opess connection where possible.
- **Host not on netplan**: out of scope. The module reads `OPESS_NETPLAN_DIR` and reports clearly when netplan is absent rather than writing anything.

## Consequences

**Positive**:
- The network becomes manageable from the desktop, without an SSH session.
- Changes are persistent (netplan) and validated before they are applied.
- The confirmation window removes the lockout risk that makes network editing scary.

**Negative / tradeoffs**:
- opess now writes system configuration, so a bug can take the machine off the network.
- Wifi passphrases live on disk in the netplan files, as they already do, and the app must be careful never to return them.
- A scan can briefly disturb the wireless link.
- Until sign in exists, the control is exposed to anyone who can reach the port.
- Hosts that run NetworkManager instead of netplan are out of scope for this design.

**Neutral**:
- A new server only module and new server functions follow the existing storage and files pattern.
- The revert timer needs a long lived process; the opess server process is long lived, so an in process timer is enough.

## Follow-up

- [ ] Gate the network write actions behind sign in (scope feature 27) or a loopback binding before this ships at GA.
- [ ] Support hosts that run NetworkManager instead of netplan, if opess is ever deployed on one.

## Rationale

Reasoning and options: see [rationale.md](./rationale.md).
