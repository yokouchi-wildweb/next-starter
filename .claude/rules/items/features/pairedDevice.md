---
paths:
  - "src/features/core/pairedDevice/**"
  - "src/config/features/pairedDevice.config.ts"
---
# features/pairedDevice
what: shared devices (store tablets, kiosks) registered as a principal apart from user accounts, authenticated by a long-lived device token cookie; routes createDeviceRoute (@/wiring/apiRoute), pages deviceGuard / principalGuard (services/server/session), hooks @/features/pairedDevice/hooks
use: pairedDevice
change: add = a device kind in kinds/ (kinds, extensionPoints.ts) | placement = src/config/features/pairedDevice.config.ts
rules:
using:
- scope_from_device: store / table ids come from device.scope on the server, never from the body or a client id
- device_rate_limit: a device route limits per device id, never per IP (in-store devices share one IP)
- device_initiated_opt_in: add "device_initiated" to pairingFlows only for the kinds that need it (a lured approval of an attacker's code is possible)
- device_pages_outside_user: device pages sit outside the user (protected) groups; the approval page needs a login
- same_redirect: a loader's redirectTo equals its layout guard's
- heartbeat_display_only: a display-only device page that calls no device API places useSessionDevice({ refreshInterval }) to extend the cookie
- revoke_on_scope_change: deleting or moving the data a scope names revokes its devices with revokePairedDevicesByScope in the same tx (or re-scopes them), not a DB lookup in verify
- system_actor_cli: actor "system" only from CLI / cron; HTTP routes always pass the user
- code_from_url_suspense: a part using useDevicePairingCodeFromUrl sits inside <Suspense>
read: turn it on, config → Usage | add a kind → Extension | routes, pages, screens → Usage | API list, audit, data → API | pairing and real devices → Internals
