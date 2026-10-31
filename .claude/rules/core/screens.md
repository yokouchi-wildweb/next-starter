---
paths:
  - "src/app/**"
  - "src/lib/screens/**"
  - "src/config/app/screens.config.ts"
  - "src/features/core/admin/services/server/screenData/**"
  - "src/lib/pageGuard/**"
---
# SCREENS + page guard flow
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

route: page.tsx = downstream-owned 1-line switch `export { XScreen as default } from "./_screen/XScreen"` (metadata / dynamic OK) | _screen/\<Name\>Screen.tsx = default Screen, owned by the route creator (downstream never edits/deletes upstream ones) | _screen/ may hold the default Screen's private parts | _components/ = downstream Screens and parts only, never upstream | 1 route = 1 Screen
screen: server component, named export, no default export, NO "use client", never try/catch | awaits the same route's loader at the top level of its body before the first return (D21, test:screens + route map) | hook-bound bits → a "use client" part in _screen/ or a section container
loader: src/app/\<route\>/_screen/loader.ts, never in features/\<domain\> | `load<Name>Screen = createLoader({ access, key?, load })` from the NEAREST guard.ts + `import "server-only"` | access required (public / authenticated / {roles, roleCategories} / none) | key(props) → primitives (cache key, return type `Promise<[...]>`) | does redirect / notFound itself, returns an explicit minimal DTO whose types it defines | never imports from _components/ or a Screen | every page has one (access-only when no data)
session: principal = load's ctx.user (public: non-null only for available statuses, widen with allowStatuses) | own record → requireUserRecord(ctx.user, redirectTo) | extra rule check → ctx.allows(rule) | no session API (getSessionUser etc.) anywhere in src/app, loaders included (lint page-authz/session-api-callsite) | folder names like (protected) mean nothing
range: guard.ts beside the range's layout.tsx exports only { guard, createLoader, extend } | policy written as a literal object | child = nearest parent's extend (AND, narrows only) | non-public range's layout calls `await guard()` | never edit an upstream guard.ts → add a child range | ref: src/lib/pageGuard/README.md
contracts (rename = keep the old export + .notices): Screen entry, loader (name / args / DTO / redirects), hooks, section container top-level props | not contract: parts, Screen internals
downstream (default rule): every fork user-facing page uses this structure | no unmigrated-route exception list (FORK_LEGACY_ROUTES removed): a non-switch page.tsx fails test:screens and routes:map | replace an upstream Screen = copy it to _components/\<X\>Screen.tsx, keep calling the upstream loader, point page.tsx at it | never delete / move / rename an upstream route (a `_` prefix rename too): switch it off (app-features pages / feature-gate), route-map shows it gated-off
upstream (MANDATORY): never put logic back in page.tsx | new core route = switch form from the start | frame layout.tsx (renders a frame) = same 1-line switch to ./_layout/\<Name\>Layout (slots = optional props: omitted = default, null = none), checked by test:screens | guard layouts admin/(protected), admin/insane = `await guard()` + plain import of the ./_layout frame, provider-owned
test: pnpm test:screens auto-discovers every page under src/app (no registration; `_` dirs skipped) | ref: src/lib/screens/README.md
route_map: src/app/route-map.jsonl = generated authz map, 1 JSON per page (chain page → Screen → loader access → guard.ts policies), every row verified, unreadable chain = pnpm routes:map fails | never hand-edit → pnpm routes:map; drift fails pnpm test:route-map; merge conflict → rerun it | human view: pnpm routes:show
admin_generated: dc:generate admin routes use the same structure: each route has _screen/loader.ts = the nearest guard.ts createLoader(admin*Parts(...) from @/wiring/adminScreenParts) | fetch bodies in features/core/admin/services/server/screenData/ (service passed in, no registry) | ref: src/lib/screens/README.md §12
flow: proxy (redirectProxy, cookie JWT) → range guard.ts (guard()) → loader access (createLoader, ctx.user) | debug pages go under src/app/debug/, never re-implement guards | lint page-authz (error, every tier): UI places never value-import services/server or DB incl. entities/drizzle (named exception AuthSessionProvider) | ref: src/features/core/auth/README.md
