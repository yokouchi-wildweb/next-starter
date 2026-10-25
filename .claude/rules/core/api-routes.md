---
paths:
  - "src/app/api/**"
  - "src/lib/routeFactory/**"
  - "src/registry/serviceRegistry.ts"
  - "src/features/**/services/server/domainEntry*.ts"
  - "src/wiring/**"
  - "src/config/app/domain-api-access.config.ts"
  - "src/features/**/domain.json"
---
# API_ROUTES
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /upreq) | FORMAT_RULE applies

generic: /api/[domain]/** exposes the CRUD operations (list: src/app/api/[domain]/) | access = the domain's services/server/domainEntry.ts entry { service: () => import(...), access } (TYPE-REQUIRED; business: domain.json apiAccess → dc:generate; core: hand-written; fork override = domainEntry.override.ts) | serviceRegistry.ts = generated from them (registry:generate), the runtime source
- data_operations: truncateAll / export / import open only when access.operations names them (unset = none, never falls back to read/write/admin) | admin routes (domains list / truncate / data-migration) gate on their own guard AND this rule, any denied domain → whole request denied | INTERNAL_ONLY = registered for getService, closed everywhere
- lookup: ドメイン名 → service / table / id column = serviceRegistry only (never a new per-feature map) | server callers import src/wiring/domains.ts (getService / lookupDomainService; allowed from src/app, src/proxies, src/proxy.ts, cron task.ts only); lib receives it injected | ref: src/lib/domain/README.md
- access rules: public | authenticated | none | {roles, roleCategories}, per-op override | CRUD op not covered → fail-closed admin only | presets: ADMIN_ONLY, PUBLIC_READ, ADMIN_OR_DEBUGGER, INTERNAL_ONLY (all none), plus single rules ADMIN_RULE / ADMIN_OR_DEBUGGER_RULE for createApiRoute or a per-op override and ADMIN_DATA_OPERATIONS (truncateAll / export / import = admin) (src/config/app/domain-api-access.config.ts) | domainEntry.ts may statically import only @/lib/domain/types and this config (registry:check)
custom_route_authz: createApiRoute `access` is TYPE-REQUIRED: "public" | "authenticated" | {roles, roleCategories} | "custom" | "custom" → guard inside the handler via requireAdmin() / requireAuthenticated() (@/features/core/auth/services/server/requireRole) | lint route-authz/require-authz warns on an unguarded "custom"
role checks always use the DB-synced getSessionUser | debug APIs: copy GET /api/debug/ping (ADMIN_OR_DEBUGGER_RULE)
