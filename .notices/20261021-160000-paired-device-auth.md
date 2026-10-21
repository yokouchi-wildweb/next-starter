# DOWNSTREAM NOTICE id:20261021-160000-paired-device-auth
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-21T16:00:00+09:00
severity: action-required
checkpoint: paired-device-auth
change: New opt-in core domain `pairedDevice` (shared kiosk / store-tablet devices as an auth principal separate from users): tables `paired_devices` / `device_pairings` (feature-gated by `PAIRED_DEVICE_CONFIG.enabled`, default false), kind registry `src/registry/pairedDeviceKindRegistry.ts` (empty upstream), `createDeviceRoute` in `@/lib/routeFactory`, `deviceGuard` / `requireCurrentDevice` / `getSessionDevice`, device-side API `/api/paired-device/**`, management API `/api/paired-devices/**`, hooks, `OneTimeCodeInput` (Form/Input/Manual), cron `paired-device-pairings-prune`, CLI `pnpm task paired-device-pair`. The audit enum `audit_actor_type` gains the value `device` (always, independent of the flag). New rate-limit categories `pairedDeviceClaim` / `pairedDevicePairingStart` / `pairedDevicePairingPoll`.
why: every fork's DB needs the new `audit_actor_type` enum value to stay in sync with the schema (`pnpm db:push:check` reports it until pushed). Forks with Vercel crons must regenerate vercel.json for the new cron task. Using the feature itself is optional.
required_actions:
1. Merge upstream. `src/registry/pairedDeviceKindRegistry.ts` is a new hand-edited registry (fork-editable like interactionTargetRegistry); take upstream's version unless the fork already has one.
2. If the fork keeps a generated vercel.json: run `pnpm cron:generate --plan <the plan the fork already uses>` and commit the result (the task is listed even while the feature is off; its route returns skipped).
3. [user-run] pnpm db:push
4. Run `pnpm db:push:check` and confirm it reports zero statements.
verify: `pnpm tsc --noEmit` passes; `pnpm test:feature-gate` passes; `pnpm test:cron-wiring` passes; `pnpm db:push:check` reports zero statements.
manual_steps: -
refs: src/features/core/pairedDevice/README.md (enable, kind registration, screen recipes), src/lib/routeFactory/README.md §4 createDeviceRoute, src/config/app/paired-device.config.ts, upstream-request 20261021-122421-device-pairing-auth
notes: To adopt it (optional): set `PAIRED_DEVICE_CONFIG.enabled = true`, register kinds with `definePairedDeviceKind` (scopeSchema / manageableScopes / verify), `pnpm db:push`, then build the pairing / approval / management screens in the fork from the hooks (core ships no domain UI). TriQ requested this (store tablet + per-table terminals); TriQ's interim floor.store_id + URL tableId resolution can switch to `device.scope` in its single resolver. Other forks: not checked.
