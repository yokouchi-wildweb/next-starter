---
paths:
  - "src/proxy.ts"
  - "src/proxies/**"
  - "src/domains/**/plugs/proxyHandlers/**"
  - "src/domains/**/plugs/proxyDecorators/**"
  - "src/domains/**/plugs/proxyRedirects/**"
  - "scripts/structure/proxies/**"
  - "src/featureGate/**"
  - "src/config/featureGate/**"
---
# proxy
> **ROLE**: loaded when writing the proxy, its items or the feature gate | holds PROXY detail
> Tier1-owned: forks never edit (gap → /order next-starter)

entry: src/proxy.ts builds one ctx per request and runs src/proxies/index.ts | handler returns Response (intercept) or void (pass) → fallback NextResponse.next() + decorators (skipped when a handler intercepts)
- x-pathname: proxy.ts sets it on request headers → read only by the page guard (returnTo, auth authorization.ts) | the root layout never reads request headers (site theme and area come from its head bootstrap script)
chain: src/proxies declares the stages maintenance → mode → gate → redirect → main (gate and redirect = its skeleton) | a handler names its stage (`export const stage`); within a stage and for decorators, order = \<plugging side\>/\<name\> | items never depend on each other | a new stage → ask upstream
add: item = \<domain\>/plugs/proxyHandlers|proxyDecorators|proxyRedirects/\<name\>.ts (upstream and fork alike, in the own domain, no fork-name marker) with exactly one `export const handler` (+ `export const stage`: maintenance / mode / main) or `export const decorator` → pnpm generate extensions | forks never edit index.ts | decision logic lives in the owning domain's service
- generator: declaration src/proxies/extensionPoints.ts → lists src/proxies/extensions/ (never hand-edit; pnpm check extensions runs at build) | ref: scripts/structure/extensions/README.md
matcher: src/proxy.ts `config.matcher` excludes static files only (/_next/static, /_next/image, /assets/, favicon.ico, robots.txt, sitemap.xml) | never exclude by file extension (dotted pages and /api would skip the gate) | a literal, forks never change it (need → /order next-starter) | ref: src/proxies/README.md Internals
maintenance_read: the maintenance item returns on allowed paths before reading the window (no DB read) | /maintenance and other paths read settingService.isMaintenanceActive
user: `await ctx.user()` = DB-synced user, lazy + memoized per request, null unless an available status (or DB unconfigured) | resolver = the proxyUser point's item (upstream auth plugs/proxyUser/session.ts), called only in src/proxy.ts
- items never resolve the session themselves (lint page-authz/session-api-callsite on src/proxies/** and \<domain\>/plugs/proxyHandlers|proxyDecorators|proxyRedirects)
- the proxyUser point: exactly one (`max: 1` + required) | its item is a 1-line switch a fork replaces with session.replace (replace point authProxyUser) | ProxyContext's user and role types come from its item type
gate: the proxy item featureGate.ts only calls gate.path and builds the response | rules, always-open declarations, guards → src/featureGate/README.md (no exception lists)

feature_gate (MANDATORY): feature = the unit a project switches on or off = rule src/featureGate/rules/\<name\>.ts = FeatureName (pathPatterns, domains, dependsOn AND, anyOf OR, when AND, defaultEnabled; fork values src/config/featureGate/switches.config.ts) | domain = no switch of its own, open while any open feature lists it (always-open: declared, never listed) | ref: src/featureGate/README.md
- rules: definitions only, never a domain import | a rule listing an always-open domain stops (check) | pathPatterns * = one non-empty segment | when = <domain>.<name>, a top-level boolean export of that domain's config.ts (unknown name or non-boolean stops generation) | the generated list (src/featureGate/extensions/whenInputs.ts) imports only the config.ts files a when names 
  - judged on server and proxy, the client gets results | a rule's enabled() reads env and constants only | a domain's config.ts value-imports only @/lib/defineConfig, its own config values file and zod (lint config-overrides/config-imports)
- closed: a closed feature → its own paths 404 | a domain no open feature lists → its tables / generic API / cron closed
- read: gate.enabled/assert/path/filter, client useGate(), node.ts = scripts/tests | links = shelf Link | 1 URL = 1 feature (nested → dependsOn parent) | new route/feature → its rule | pnpm ops features list|set | guarded by the tests of src/featureGate and scripts/structure/proxies (FEATURE_GATE_CHECK=all, run by /ship)
- outside: code outside a gated domain that uses it → wrap with the gate (requires / gate / required/) | unused upstream page → close its feature
gate_values_in_range: a range's gate values (e.g. the admin frame's) are computed inside that range's guard layout, never at the root (no admin addresses in public HTML)
