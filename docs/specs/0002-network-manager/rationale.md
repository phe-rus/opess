# Rationale: 0002 Manage the host network from opess

## Context

opess already shows the network. The Settings app lists each interface with its address, MAC, gateway, speed, and DHCP state, plus the DNS servers, read through the `systeminformation` package. It is read only. Every change a homelab owner actually needs (join a wifi network, set a static address, change DNS) still means an SSH session and hand editing YAML.

The machine this runs on is an Armbian board (an Orange Pi 5 Plus) whose network is configured by netplan, rendered into systemd-networkd, with wpa_supplicant handling wireless authentication. NetworkManager and iwd are not installed, and `/etc/network/interfaces` does not exist. The opess server runs as root, so it can already read and write system configuration. The netplan files in `/etc/netplan/` hold the wifi access point and passphrase today.

The dangerous property of this feature is that a network change can cut the very connection being used to make it. A wrong address or gateway locks the user out and forces a walk to the machine with a keyboard. Any design here has to make that outcome recoverable.

> ⚠️ Premise note: this feature turns an open port into a network takeover primitive. There is no sign in yet (scope feature 27 is planned), and opess is reachable on the LAN, so any client that can reach port 3000 could reconfigure the host network and read wifi passphrases. The right framing is to treat network control as admin only and require the sign in gate (or a loopback binding) before it is enabled. This spec designs the control and defaults every write action off behind `OPESS_NETWORK_CONTROL`, and carries the gate as the first Follow-up.

A scope note: this one decision covers scope features 20 (network manager), 21 (wifi management), and 22 (ethernet configuration). They share a single backend, safety model, and config writer, so splitting them would duplicate the same design three times.

## Options considered

### Option 1: netplan with systemd-networkd and wpa_supplicant

Write the netplan YAML the machine already uses, validate with `netplan generate`, apply with `netplan apply`, and read live state from `networkctl` and `iw`. netplan renders the config into systemd-networkd and hands wifi to wpa_supplicant.

**Pros**:
- Changes the network through the layer the machine already runs, so opess and the board agree on one source of truth.
- Persists across reboots for free, because netplan is the boot time config.
- No new daemon, no conflict with what is installed, no extra operational surface.
- `netplan generate` gives a validation gate before anything is applied.

**Cons**:
- The netplan YAML schema is rich, so the writer must handle the shapes it may meet.
- Reading live state means shelling out to `networkctl` and `iw` and parsing their output.

### Option 2: Install NetworkManager and drive it with nmcli

Install NetworkManager, take the interfaces away from netplan and systemd-networkd, and control them through `nmcli`, which has a stable, scriptable interface and a well known D-Bus API.

**Pros**:
- A richer, better documented control API than netplan's YAML.
- Wifi management and connection profiles are first class.

**Cons**:
- Adds a second network manager to a machine that is working, and the two fight over the interfaces until the old config is removed.
- Changes how the host boots its network, a large operational risk for a homelab box someone depends on.
- More moving parts to operate at 2am, for a feature netplan already covers.

### Option 3: Apply changes live with ip, iw, and wpa_cli

Change the running network directly with low level tools and keep no persistent config.

**Pros**:
- The smallest surface, and easy to reason about per command.

**Cons**:
- Changes are lost on reboot, which fails AC-3 and AC-5.
- No config file means nothing to validate or snapshot, so revert has nothing to restore.

## Rationale

The machine already runs netplan over systemd-networkd, and the boring, correct answer is to change the network the same way the board does. Option 1 keeps one source of truth, needs no new daemon, and gets persistence and a validation gate for free, which directly serves AC-3, AC-5, and AC-8. Option 2 would work, and its API is nicer, but it means taking the interfaces away from the layer that currently owns them and changing how the host boots its network, a real operational risk on a box the user depends on. Option 3 cannot persist a change, so it fails the persistence criteria outright.

The lockout risk (AC-6) is the reason the design adds its own confirmation window rather than applying changes blindly. netplan ships a similar mechanism (`netplan try`, which reverts after a timeout unless the user confirms at the terminal), but it expects an interactive terminal, and the web request flow does not hold a process open cleanly. A snapshot plus an in process revert timer is explicit, works over HTTP, is easy to test, and does not depend on a pseudo terminal. (`netplan try` remains the runner up, and becomes more attractive once the terminal feature lands.)

Two smaller calls, made here rather than left open:
- Reading live state uses `networkctl` and `iw` for the values that `systeminformation` does not give (interface type, link state, connected SSID), and keeps the existing `systeminformation` path for address, gateway, and DNS. Reusing the existing read path avoids a second source for the same values.
- The confirmation window defaults to 120 seconds, matching the timeout people expect from `netplan try`, and is configurable through `OPESS_NETWORK_CONFIRM_TIMEOUT`.

## Amendment (2026-10-15, after the first build)

The read model landed first, and building it corrected three source choices the Value sourcing table had named before the host was inspected:

- **kind and SSID**: the table said `iw dev`. `networkctl --json=short list` returns both in the same structured document as everything else, so opess reads one source instead of parsing a second tool's text output. `iw` stays only where networkctl cannot help: scanning.
- **DHCP or static**: the table said `netplan get`. That cannot answer per interface, because netplan is written with `match:` patterns (the `e*` block configures both ethernet ports, and the wifi block is keyed by name), so resolving it per interface means reimplementing netplan's matcher. The rendered network file networkd picked for the link carries the resolved answer (`DHCP=yes`), and it exists even while the link is down, which the live address alone cannot show.
- **per link DNS** was added to the table while building, because networkctl reports it per link and the interface card has a place for it.

The scan source also became netplan native: netplan runs its own wpa_supplicant per interface (`netplan-wpa-wlP2p33s0.service`, active) with `ctrl_interface=/run/wpa_supplicant`, and `wpa_cli` is installed (netplan itself uses it for `reload`), so a scan can go through the instance that owns the link instead of poking the driver with `iw`.

The passphrase check corrected AC-9 as well. The passphrase is clear text in three files on this host (the two netplan files, and the wpa_supplicant config netplan generates), so the criterion's claim that it is written only into the netplan file was wrong, and the `getNetworkConfig` row would have returned it. The mask rule, the corrected criterion, and the security note come from that check.
