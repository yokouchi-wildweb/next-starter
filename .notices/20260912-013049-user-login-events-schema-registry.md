# DOWNSTREAM NOTICE id:20260912-013049-user-login-events-schema-registry
from: next-starter (Tier1 upstream) | branch:main | commit:628d86df
date: 2026-09-12T01:30:49Z
severity: action-required
change: `UserLoginEventTable` / `UserLoginEventTypeEnum` (userLoginEvent domain, upstream commit bfb68777) are now exported from src/registry/schemaRegistry.ts. They were missing since the domain shipped, so db:push never created `user_login_events` + enum `user_login_event_type`. New guard test `pnpm test:schema-registry` (scripts/registry/check-schema-registry.test.mjs) fails when any src/features/core/*/entities/drizzle.ts is not referenced from schemaRegistry.
why: recordLoginEvent is bestEffort (swallows errors), so every fork has been silently recording nothing since it merged the userLoginEvent domain. Readers of the table (ipAnalytics same-IP detection, user login-history panes, cron user-login-event-prune) fail with "relation user_login_events does not exist" until the table is pushed. Past login events cannot be recovered; accumulation starts at db:push.
required_actions:
1. If src/registry/schemaRegistry.ts has a local stopgap export for userLoginEvent (e.g. with a "remove once upstream ships" comment), resolve the merge by keeping exactly ONE line `export * from "@/features/core/userLoginEvent/entities/drizzle";` in the CORE DOMAINS block (this domain has no `@/features/userLoginEvent/*` tsconfig alias; the `core/` path is required) and delete the local comment. Upstream placed it right after the couponIssuerGrant export.
2. pnpm test:schema-registry   # must pass (also catches any downstream-added core drizzle.ts that was never registered)
3. [user-run] pnpm db:push   # creates user_login_events + enum user_login_event_type + 4 indexes (table is empty, non-CONCURRENT index build is fine)
verify: `pnpm db:tables` lists user_login_events; `pnpm db:query "SELECT count(*) FROM user_login_events"` returns 0 (not "relation does not exist"); `npx tsc --noEmit` green; after one login, count becomes 1.
manual_steps: -
refs: src/registry/schemaRegistry.ts, src/features/core/userLoginEvent/entities/drizzle.ts, src/features/core/userLoginEvent/services/server/recordLoginEvent.ts, scripts/registry/check-schema-registry.test.mjs, upstream-requests 20260912-102632-user-login-events-schema-registry
notes: Additive only; no existing rows, no code behavior change. If a fork runs cron user-login-event-prune on a schedule, it starts succeeding once the table exists. Consider running `pnpm test:schema-registry` in CI alongside `pnpm test:crud-hooks`.
