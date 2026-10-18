# Epic: Server administration

Administer the machine opess runs on: sign in, users, server settings, updates, config backup, and an audit trail.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Settings app | Existing | existing |
| 27 | Sign in & sessions | Slice 6 · GA | planned |
| 28 | Account & credentials | Slice 6 · GA | planned |
| 29 | Server settings | Slice 6 | planned |
| 30 | System updates | Slice 6 · GA | planned |
| 31 | Config backup & restore | Slice 6 | planned |
| 32 | Audit log | Slice 6 · GA | planned |

## Existing

### A. Settings app · existing
Apple System Settings style app with Network, Wallpaper, Storage, and About sections. This becomes the home for the broader server administration below. code in `src/components/apps/app-settings/settings.tsx`.

## Slice 6: Server administration

### 27. Sign in & sessions · GA · needs a decision
A sign in so the server is not wide open to anyone who reaches the port. One owner account, protected by a password, and optionally a passkey or a passcode, with sessions that survive a reload.

**Done when:** an unauthenticated visitor cannot reach server controls, the owner can sign in by password, passkey, or passcode, and sessions expire and can be revoked.
- [ ] Design it (spec): `/architect sign in & sessions`

### 28. Account & credentials · GA
Manage the single owner account: change the password, add or remove passkeys, and generate recovery codes. Separate from signing in (#27). Recovery matters so a lost credential does not lock the owner out of their own server.

**Done when:** the owner can change their password, manage passkeys, and use recovery codes, and a lost credential does not permanently lock them out.
- [ ] Develop it: `/develop account & credentials`

### 29. Server settings
Edit hostname, timezone, locale, and other system level settings from the Settings app.

**Done when:** each setting reads its current value and writes changes that persist across restart.
- [ ] Develop it: `/develop server settings`

### 30. System updates · GA
Check for and apply updates to the host and to opess itself, with visible progress.

**Done when:** available updates are listed, applying one shows progress, and a failed update leaves the system usable.
- [ ] Develop it: `/develop system updates`

### 31. Config backup & restore
Export opess configuration (users, settings, desktop state, installed apps) and restore it, so a rebuild is painless.

**Done when:** an export produces a restorable file and a restore returns the server to that state.
- [ ] Develop it: `/develop config backup & restore`

### 32. Audit log · GA
A record of who did what (install, delete, format, sign in) so changes are traceable.

**Done when:** sensitive actions are recorded with actor, time, and target, and the log is searchable and not editable from the UI.
- [ ] Develop it: `/develop audit log`

## Deferred

- **Reverse proxy & TLS**: attach and manage HTTPS certificates and a proxy · needs a decision · GA
- **Multiple servers / fleet**: manage more than one machine from one opess · needs a decision
- **Resource quotas**: limit what a user or app can consume · needs a decision · GA
