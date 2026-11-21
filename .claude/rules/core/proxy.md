---
paths:
  - "src/proxy.ts"
  - "src/proxies/**"
  - "scripts/structure/proxies/**"
  - "src/featureGate/**"
  - "src/config/featureGate/**"
---
# proxy
> **ROLE**: loaded when writing the proxy, its items or the feature gate | holds PROXY detail
> Tier1-owned: forks never edit (gap → /order next-starter)

entry: src/proxy.ts builds one ctx per request and runs src/proxies/index.ts | handler returns Response (intercept) or void (pass) → fallback NextResponse.next() + decorators (skipped when a handler intercepts)
- x-pathname: proxy.ts sets it on request headers → read only by the page guard (returnTo, auth authorization.ts) | the root layout never reads request headers (site theme and area come from its head bootstrap script)
chain: skeleton (upstream, hand-written in index.ts) maintenance → demoMode → featureGate → redirect, decorators attribution → inviteLink | then the frame: items in file-name order (no Tier order), independent of each other | never before the skeleton (need → ask upstream)
add: item = src/proxies/\<name\>.ts (upstream and fork alike, no fork-name marker) with exactly one `export const handler` or `export const decorator` → pnpm generate extensions | forks never edit index.ts | decision logic lives in the owning domain's service
- generator: declaration src/proxies/extensionPoints.ts → lists src/proxies/extensions/ (never hand-edit; pnpm check extensions runs at build) | ref: scripts/structure/extensions/README.md
matcher: src/proxy.ts `config.matcher` excludes static files only (/_next/static, /_next/image, /assets/, favicon.ico, robots.txt, sitemap.xml) | never exclude by file extension (dotted pages and /api would skip the gate) | a literal, forks never change it (need → /order next-starter) | ref: src/proxies/README.md Internals
maintenance_read: the maintenance item returns on allowed paths before reading the window (no DB read) | /maintenance and other paths read settingService.isMaintenanceActive
user: `await ctx.user()` = DB-synced user, lazy + memoized per request, null unless an available status (or DB unconfigured) | resolver = auth createProxyUser, built only in src/proxy.ts | items never resolve the session themselves (lint page-authz/session-api-callsite on src/proxies/**)
gate: the proxy item featureGate.ts only calls gate.path and builds the response | rules, always-on entries, fork exceptions, guards → src/featureGate/README.md

feature_gate (MANDATORY): feature = the unit a project switches on or off = rule src/featureGate/rules/\<name\>.ts = FeatureName (pathPatterns, domains, dependsOn AND, anyOf OR, defaultEnabled; fork values src/config/featureGate/switches.config.ts) | domain = no switch of its own, open while any open feature lists it (none = base) | ref: src/featureGate/README.md
- closed: a closed feature → its own paths 404 | a domain no open feature lists → its tables / generic API / cron closed
- read: gate.enabled/assert/path/filter, client useGate(), node.ts = scripts/tests | links = shelf Link | 1 URL = 1 feature (nested → dependsOn parent) | new route/feature → its rule | always-on entries close themselves | pnpm ops features list|set | guarded by the tests of src/featureGate and scripts/structure/proxies (FEATURE_GATE_CHECK=all, run by /ship)
- outside: code outside a gated domain that uses it → wrap with the gate (requires / gate / required/) | unused upstream page → close its feature
gate_values_in_range: a range's gate values (e.g. the admin frame's) are computed inside that range's guard layout, never at the root (no admin addresses in public HTML)
