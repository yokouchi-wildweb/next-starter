---
paths:
  - "src/domains/**/services/server/**"
  - "src/app/api/**"
  - "src/lib/audit/**"
  - "src/domains/core/auditLog/config.ts"
  - "src/config/domains/auditLog.config.ts"
  - "scripts/**"
---
# audit
> **ROLE**: loaded when writing server services, API routes or scripts | holds the audit rules (CLAUDE.md CRUD_SERVICE audit)
> Tier1-owned: forks never edit (gap → /order next-starter)

action_naming: \<domain\>.\<entity\>.\<verb_past\> (e.g. user.email.changed, ESLint audit/action-naming: auditLogger calls and any object literal with action + targetType, i.e. injected recorders too)
usage: auto = createCrudService audit option | manual = auditLogger.record({..., tx}) from @/domains/core/auditLog/services/server (server-only) | pass tx for rollback consistency
context: the entry sets it, never a domain function: request → routeFactory (actor / ip / id) | pnpm task, pnpm ops data → the runner | scheduled cron → the cron route (createCronTaskRoute from @/wiring/cronRoute) | no such entry (hand-written ops) → wrap it in runAsSystem (nesting is safe; else "AuditContext is not set")
user_visibility: GET /api/me/audit-logs returns only actions allow-listed in auditLogConfig.userVisibleActions (owner src/domains/core/auditLog/config.ts, fork override src/config/domains/auditLog.config.ts; upstream empty = always empty) | covert admin actions stay invisible to the target user
secrets: tracked fields pass the cross-domain denylist (src/lib/audit/denylist.ts) | auditLog = compliance record, never reuse it for behavior aggregation | ref: src/domains/core/auditLog/README.md
