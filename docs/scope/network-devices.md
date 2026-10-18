# Epic: Network & devices

Manage the server's network and the devices around it: interfaces, wifi, ethernet, and later bluetooth and device to device sharing.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Network interfaces panel | Existing | existing |
| 20 | Network manager | Slice 4 · GA | in-progress |
| 21 | Wifi management | Slice 4 · GA | planned |
| 22 | Ethernet configuration | Slice 4 · GA | planned |

## Existing

### A. Network interfaces panel · existing
The Settings app shows connection summary, DNS, and each interface with address, MAC, gateway, speed, and DHCP state. code in `src/components/apps/app-settings/settings.tsx`, `src/lib/storage.ts`.

## Slice 4: Network & devices

### 20. Network manager · GA
View interfaces and edit their configuration (address, DNS, gateway, routes) from opess, not just read them. This one decision also delivers wifi management (feature 21) and ethernet addressing (feature 22), which share the same backend and safety model.

**Done when:** changes apply to the real network config, a bad change is caught before it locks you out, and the current state is shown accurately.
spec [0002](../specs/0002-network-manager/index.md) · code in `src/lib/network.ts`, `src/lib/storage.ts`, `src/components/apps/app-settings/settings.tsx`
- [x] Design it (spec): `/architect network manager`
- [ ] Build it: `/develop network manager`
  - [x] Read model: interface type, link state, DHCP or static, and the connected SSID in the Network section (AC-1)
  - [ ] Control module end to end on one safe action: snapshot, `netplan generate`, apply, and the confirmation window with automatic revert (AC-5, AC-6, AC-8)
  - [ ] Wifi scan with the connected marker (AC-2)
  - [ ] Wifi join and leave, persisted, with passphrases never read back (AC-3, AC-4, AC-9)
  - [ ] Interface addressing: DHCP and static (AC-5)
  - [ ] Input validation and error mapping on every write (AC-7)
- [ ] Verify it: `/check verify network manager`
- [ ] Test it: `/test network manager`
- [ ] Review it (fresh model): `/check review network manager`
- [ ] Document it: `/document network manager`

### 21. Wifi management · GA
Scan for networks, connect, disconnect, and see signal and saved networks. Shares the design in spec 0002 with feature 20, so there is one backend, not two.

**Done when:** nearby networks are listed, joining a network works with a passphrase, and the active connection is clearly shown.
spec [0002](../specs/0002-network-manager/index.md) · built with feature 20
- [ ] Develop it: `/develop wifi management`

### 22. Ethernet configuration · GA
See link state and speed, and set addressing (DHCP or static) for ethernet. Shares the design in spec 0002 with feature 20.

**Done when:** ethernet status is shown accurately and switching between DHCP and static applies and persists.
spec [0002](../specs/0002-network-manager/index.md) · built with feature 20
- [ ] Develop it: `/develop ethernet configuration`

## Deferred

- **Bluetooth pairing**: scan and pair bluetooth devices · needs a decision · GA
- **Remote device management**: pair and control other devices from opess · needs a decision · GA
- **Device sharing**: airdrop style send and receive between your devices · needs a decision
- **Firewall & ports**: view and edit firewall rules and open ports · needs a decision · GA
- **VPN**: manage VPN connections · needs a decision · GA
