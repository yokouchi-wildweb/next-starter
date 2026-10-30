---
paths:
  - "src/app/**"
  - "src/lib/screens/**"
  - "src/registry/screenRoutesRegistry.ts"
  - "src/features/core/admin/services/server/screenData/**"
---
# SCREENS + page guard flow
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

route: page.tsx = downstream-owned 1-line switch `export { XScreen as default } from "./_screen/XScreen"` (metadata / dynamic OK) | _screen/\<Name\>Screen.tsx = default Screen, owned by the route creator (downstream never edits/deletes upstream ones) | _screen/ may hold the default Screen's private parts | _components/ = downstream Screens and parts only, never upstream | 1 route = 1 Screen
screen: server component, named export, no default export, NO "use client", never try/catch | hook-bound bits → a "use client" part in _screen/ or a section container
loader: src/app/\<route\>/_screen/loader.ts, never in features/\<domain\> | `load<Name>Screen(props)` = `import "server-only"` + React cache() keyed by resolved primitives + does redirect / notFound itself + returns an explicit minimal DTO whose types it defines | never imports from _components/ or a Screen
session: under (protected) the loader uses only requireCurrentUser({behavior:"redirect", redirectTo = the group's authGuard literal}) | getSessionUser (nullable) only outside (protected): optional personalization, or (auth) pages that redirect by login / status
contracts (rename = keep the old export + .notices): Screen entry, loader (name / args / DTO / redirects), hooks, section container top-level props | not contract: parts, Screen internals
downstream (default rule): every fork user-facing page uses this structure | unmigrated fork routes MUST be listed with a reason in FORK_LEGACY_ROUTES (the list only shrinks) | replace an upstream Screen = copy it to _components/\<X\>Screen.tsx, keep calling the upstream loader, point page.tsx at it | never delete / move / rename an upstream route (a `_` prefix rename too): switch it off (app-features pages / feature-gate), route-map shows it gated-off
upstream (MANDATORY): never put logic back in page.tsx | new core route = switch form from the start, UPSTREAM_LEGACY_ROUTES stays empty | frame layout.tsx (renders a frame) = same 1-line switch to ./_layout/\<Name\>Layout (slots = optional props: omitted = default, null = none), checked by test:screens | guard layouts admin/(protected), admin/insane = guard + plain import of the ./_layout frame, provider-owned
test: pnpm test:screens auto-discovers every page under src/app (no registration; `_` dirs skipped) | route map: src/app/route-map.txt = generated authz map (URL → policy source), never hand-edit → pnpm routes:map; drift fails pnpm test:route-map; merge conflict → rerun it | ref: src/lib/screens/README.md
admin_generated: dc:generate admin routes use the same structure: each route has _screen/loader.ts = the nearest guard.ts createLoader(admin*Parts(...) from @/wiring/domains) | fetch bodies in features/core/admin/services/server/screenData/ (service passed in, no registry) | ref: src/lib/screens/README.md §12
flow: proxy (redirectProxy, cookie JWT) → layout (authGuard) → loader (requireCurrentUser = own DB record) | debug pages go under src/app/debug/, never re-implement guards | lint page-authz (error, every tier): layouts fetch no server data (authorization fns only) | session / guard APIs only in layout, _layout/, loader.ts | ref: src/features/core/auth/README.md
