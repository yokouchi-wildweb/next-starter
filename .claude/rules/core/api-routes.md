---
paths:
  - "src/app/api/**"
  - "src/lib/routeFactory/**"
  - "src/registry/serviceRegistry.ts"
  - "src/config/app/domain-api-access.config.ts"
  - "src/features/**/domain.json"
---
# API_ROUTES
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /upreq) | FORMAT_RULE applies

generic: /api/[domain]/** exposes the CRUD operations (list: src/app/api/[domain]/) | access = serviceRegistry entry { service, access } (TYPE-REQUIRED; domain.json apiAccess → dc:generate; core domains write it in the registry)
- access rules: public | authenticated | none | {roles, roleCategories}, per-op override | not covered → fail-closed admin only | presets: ADMIN_ONLY, PUBLIC_READ, ADMIN_OR_DEBUGGER, plus the single rule ADMIN_OR_DEBUGGER_RULE for createApiRoute or a per-op override (src/config/app/domain-api-access.config.ts)
custom_route_authz: createApiRoute `access` is TYPE-REQUIRED: "public" | "authenticated" | {roles, roleCategories} | "custom" | "custom" → guard inside the handler via requireAdmin() / requireAuthenticated() (@/features/core/auth/services/server/requireRole) | lint route-authz/require-authz warns on an unguarded "custom"
role checks always use the DB-synced getSessionUser | debug APIs: copy GET /api/debug/ping (ADMIN_OR_DEBUGGER_RULE)
