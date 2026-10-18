# Verify: network manager · spec 0002 · updated 2026-10-15

_Steps derived from spec 0002 acceptance criteria and the Value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

_Not yet run. The write actions default to off (`OPESS_NETWORK_CONTROL=off`) and the auth gate is a Follow-up, so run these only on a machine you can reach physically or over a second link._

## Command

- [ ] `getNetworkInfo` returns every interface with kind, link state, address, MAC, gateway, DNS, and DHCP or static; the ethernet ports read `no-carrier` and the wifi port shows the connected address → AC-1
- [ ] `getNetworkConfig` returns the resolved netplan config with every `password` masked, and everything else matches `netplan get` run by hand → AC-1, AC-9
- [ ] `scanWifi wlP2p33s0` lists nearby networks with SSID, signal, and security, and marks the connected one → AC-2
- [ ] `connectWifi` to a known network writes an access point into a file under `$OPESS_NETPLAN_DIR`, `netplan generate` passes, and `networkctl status <if>` shows the interface associated → AC-3, AC-8
- [ ] Reboot, and the interface comes back on the joined network without any opess action → AC-3
- [ ] `disconnectWifi` applies and `iw dev <if> info` shows no SSID, and it stays gone after a reboot → AC-4
- [ ] `applyInterfaceConfig` with `mode: dhcp` on an ethernet port writes `dhcp4: true`; with `mode: static` it writes the address, gateway, and DNS, and both survive a reboot → AC-5
- [ ] `applyInterfaceConfig` with a static address that cannot reach the network, then leave it unconfirmed: after `OPESS_NETWORK_CONFIRM_TIMEOUT` seconds the snapshot is restored and the previous address is back → AC-6
- [ ] The same change confirmed with `confirmNetworkChange` before the window closes is kept, and the snapshot is pruned → AC-6
- [ ] A bad CIDR, an unknown interface, and a missing passphrase each return a clear error and leave `$OPESS_NETPLAN_DIR` byte for byte unchanged → AC-7
- [ ] A staged config that fails `netplan generate` is never applied, and the live config is untouched → AC-8
- [ ] `getNetworkInfo`, `getNetworkConfig`, `scanWifi`, and `getPendingNetworkChange` are read after a join and none of them contains a passphrase; the three files that hold it on disk (`/etc/netplan/*.yaml` and `/run/netplan/wpa-<if>.conf`) are each mode 0600 → AC-9
- [ ] With `OPESS_NETWORK_CONTROL=off` every write action is refused and nothing is written → security model
- [ ] `bunx tsc --noEmit` passes → the project gate

## UI / manual

- [ ] Open **Settings → Network** → each interface shows its kind, link state, address, gateway, DNS, and DHCP or static, matching `networkctl` → AC-1
- [ ] Open the wifi list → nearby networks show SSID, signal, and security, and the connected network is marked → AC-2
- [ ] Join a network from the desktop with a passphrase → it applies and the interface shows the new address, then reload the page and it is still connected → AC-3
- [ ] Leave a network from the desktop → the interface drops to disconnected and the marker clears → AC-4
- [ ] Change an interface to a static address, get the confirmation prompt, and let it lapse → the prompt clears and the previous address returns → AC-6
- [ ] Change an interface to a static address and confirm within the window → the new address sticks after a reload → AC-5, AC-6
- [ ] Type an invalid address → the field reports the error before anything applies and the network is unchanged → AC-7
- [ ] Inspect the joined network's read only fields → no passphrase is ever shown → AC-9
