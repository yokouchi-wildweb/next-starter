---
paths:
  - "src/app/api/**"
  - "src/lib/routeFactory/**"
  - "src/registry/serviceRegistry.ts"
  - "src/features/**/services/server/domainEntry*.ts"
  - "src/wiring/*Route*"
  - "src/lib/domain/accessPresets.ts"
  - "src/features/**/domain.json"
---
# api-routes
> **ROLE**: loaded when writing API routes or the route factory | holds API_ROUTES detail
> Tier1-owned: forks never edit (gap → /order <direct parent>)

generic: /api/[domain]/** exposes the CRUD operations (list: src/app/api/[domain]/) | access = the domain's services/server/domainEntry.ts entry { service: () => import(...), access } (TYPE-REQUIRED; business: domain.json apiAccess → pnpm generate domain; core: hand-written; fork override = domainEntry.override.ts)
- serviceRegistry.ts = generated from them (pnpm generate registry), the runtime source
- data_operations: truncateAll / export / import open only when access.operations names them (unset = none, never falls back to read/write/admin) | admin routes (domains list / truncate / data-migration) gate on their own guard AND this rule, any denied domain → whole request denied | INTERNAL_ONLY = registered for getService, closed everywhere
- lookup: ドメイン名 ↔ service / table / id column = serviceRegistry only (never a new per-feature map) | server callers import src/wiring/domainRegistry.ts (getService / lookupDomainService / findDomainByTable / getDomainTable; allowed from src/app, src/proxies, src/proxy.ts, cron task.ts only)
  - lib takes the registry as an argument or injected, never imports src/registry (lint import-boundaries/lib-no-registry, no exception list) | ref: src/lib/domain/README.md
- access rules (domainEntry.ts): public | authenticated | none | {roles, roleCategories}, per-op override | a CRUD op's rule = operations[op] → else access.read / access.write by kind → else admin only (fail-closed default)
  - presets: ADMIN_ONLY, PUBLIC_READ, ADMIN_OR_DEBUGGER, INTERNAL_ONLY (all none), plus single rules ADMIN_RULE / ADMIN_OR_DEBUGGER_RULE for createApiRoute or a per-op override and ADMIN_DATA_OPERATIONS (truncateAll / export / import = admin) = lib/domain constants, not an overridable config (src/lib/domain/accessPresets.ts, fail-closed default DEFAULT_ACCESS_RULE)
  - domainEntry.ts / domainEntry.override.ts static imports (pnpm check registry): type-only from anywhere, values only from value-only files (judged by content, transitively: literals, consts, references, object / array / spread, no function / call / new / side-effect import) → a fork's own presets live in such a file, e.g. its domain's constants/
route_access: createApiRoute `access` is TYPE-REQUIRED: "public" | "authenticated" | {roles, roleCategories} (none = generic CRUD only) | no "custom": webhook / callback = "public" + verify authenticity in the handler | extra gate = enforceAccessRule(rule, ctx.user) from @/wiring/apiRoute
- factories (all from @/wiring/apiRoute): createApiRoute | createDomainRoute / createDomainIdRoute (generic CRUD) | createMeRoute (/api/me/**, self only, scope by ctx.user) | createDeviceRoute (paired device)
- allowStatuses: on every Factory, default USER_AVAILABLE_STATUSES (= ["active"]), fail-closed | on "public" = the statuses for which ctx.user is passed
- principal: ctx.user, resolved once per request by the Factory (DB-synced; "public" → null unless the status is allowed) | role-based behavior after the gate = branch on ctx.user.role | explicit type args → pass the access as the 3rd (createApiRoute<P, unknown, "authenticated">)
- lint (all tiers error): route-http-export/http-export (GET…OPTIONS = a Factory call from @/wiring; a cron route.ts = createCronTaskRoute from @/wiring/cronRoute, never @/lib/cron's maker: import-boundaries/cron-route-via-wiring) | import-boundaries/route-factory-via-wiring | page-authz/session-api-callsite covers src/app/api/** | types: src/lib/routeFactory/routeAccess.typecheck.ts
debug APIs: copy GET /api/debug/ping (ADMIN_OR_DEBUGGER_RULE)
