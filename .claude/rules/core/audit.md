---
paths:
  - "src/features/**/services/server/**"
  - "src/app/api/**"
  - "src/lib/audit/**"
  - "src/registry/userVisibleAuditActionsRegistry.ts"
  - "scripts/**"
---
# AUDIT
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

action_naming: \<domain\>.\<entity\>.\<verb_past\> (e.g. user.email.changed, ESLint-enforced)
usage: auto = createCrudService audit option | manual = auditLogger.record({..., tx}) from @/features/core/auditLog/services/server (server-only) | pass tx for rollback consistency
context: routeFactory injects actor / ip / request id | cron / CLI do NOT → wrap recording in runAsSystem (else "AuditContext is not set")
user_visibility: GET /api/me/audit-logs returns only actions allow-listed in src/registry/userVisibleAuditActionsRegistry.ts (upstream empty = always empty) | covert admin actions stay invisible to the target user
secrets: tracked fields pass the cross-domain denylist (src/lib/audit/denylist.ts) | auditLog = compliance record, never reuse it for behavior aggregation | ref: src/features/core/auditLog/README.md
