# DOWNSTREAM NOTICE id:20261021-142959-paired-device-principal-guard
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-21T14:29:59+09:00
severity: info
checkpoint: paired-device-principal-guard
change: pairedDevice additions (no breaking change, no DB change): page guard `principalGuard` / loader `requireCurrentPrincipal` ("registered device OR user matching orUser", same vocabulary as createDeviceRoute) in `@/features/core/pairedDevice/services/server/session`; server-only `listPairedDevicesByScope` / `revokePairedDevicesByScope` (scope containment, works inside a caller tx, per-device audit) in `@/features/core/pairedDevice/services/server`; src/lib/routeFactory/README.md documents migrating an existing createApiRoute to createDeviceRoute. createApiRoute `access` intentionally does NOT accept devices.
why: forks adopting device auth for shared staff tablets need pages that open for either the tablet or a staff member's own login, and need to stop devices whose scope points at rows the fork deletes or moves. Nothing changes for forks that do not use pairedDevice.
required_actions:
1. Merge upstream. No action needed unless the fork uses pairedDevice.
2. Forks moving existing createApiRoute routes to device auth: follow src/lib/routeFactory/README.md "既存の createApiRoute を端末でも通すようにする". The swap is two lines (factory + access → kinds / orUser), but every handler that loads a row by id must also check that the row belongs to `ctx.device.scope` (e.g. storeId); without it a device of store A can operate store B's rows by id.
verify: `pnpm tsc --noEmit` passes; `pnpm test:device-route` passes.
manual_steps: -
refs: src/features/core/pairedDevice/README.md (ページ: 端末またはユーザー / scope が古くなった端末を止める), src/lib/routeFactory/README.md §4, upstream-request 20261021-142445-paired-device-access-guard-revoke
notes: TriQ requested this. In TriQ the 7 staff routes (visitGroup transition / finish / unassign / force-status / lendings, boardGameLending return / cancel) use only `{ params }`, so the body compiles unchanged after the swap, and each needs the store check above. Other forks: not checked.
