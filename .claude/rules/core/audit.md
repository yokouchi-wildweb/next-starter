---
paths:
  - "src/features/**/services/server/**"
  - "src/app/api/**"
  - "src/lib/audit/**"
  - "src/features/core/auditLog/config.ts"
  - "src/config/features/auditLog.config.ts"
  - "scripts/**"
---
# audit
> **ROLE**: loaded when writing server services, API routes or scripts | holds AUDIT detail
> Tier1-owned: forks never edit (gap → /order <direct parent>)

action_naming: \<domain\>.\<entity\>.\<verb_past\> (e.g. user.email.changed, ESLint audit/action-naming: auditLogger calls and any object literal with action + targetType, i.e. injected recorders too)
usage: auto = createCrudService audit option | manual = auditLogger.record({..., tx}) from @/features/core/auditLog/services/server (server-only) | pass tx for rollback consistency
context: routeFactory injects actor / ip / request id | pnpm task / pnpm ops data writes run in runAsSystem (the runner) | a cron run on schedule (its route, no runner) → its domain function wraps the recording in runAsSystem, like a hand-written CLI (else "AuditContext is not set")
user_visibility: GET /api/me/audit-logs returns only actions allow-listed in auditLogConfig.userVisibleActions (owner src/features/core/auditLog/config.ts, fork override src/config/features/auditLog.config.ts; upstream empty = always empty) | covert admin actions stay invisible to the target user
secrets: tracked fields pass the cross-domain denylist (src/lib/audit/denylist.ts) | auditLog = compliance record, never reuse it for behavior aggregation | ref: src/features/core/auditLog/README.md
