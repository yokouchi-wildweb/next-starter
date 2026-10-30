---
paths:
  - "src/proxy.ts"
  - "src/proxies/**"
  - "scripts/proxies/**"
---
# PROXY
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

entry: src/proxy.ts builds one ctx per request and runs src/proxies/index.ts | handler returns Response (intercept) or void (pass) → fallback NextResponse.next() + decorators (skipped when a handler intercepts) | x-pathname: proxy.ts sets it on request headers → server components read headers().get("x-pathname")
chain: skeleton (upstream, hand-written in index.ts) maintenance → demoMode → featureGate → redirect, decorators attribution → inviteLink | then the frame: items in file-name order (no Tier order), independent of each other | never before the skeleton (need → ask upstream)
add: item = src/proxies/\<name\>.ts (upstream) or \<name\>.\<fork ID\>.ts (fork, declared ID) with exactly one `export const handler` or `export const decorator` → pnpm extensions:generate | forks never edit index.ts | decision logic lives in the owning domain's service
- generator: declaration src/proxies/extensionPoints.ts → lists src/proxies/extensions/ (never hand-edit; extensions:check runs at build) | ref: scripts/extensions/README.md
user: `await ctx.user()` = DB-synced user, lazy + memoized per request, null unless an available status (or DB unconfigured) | resolver = auth createProxyUser, built only in src/proxy.ts | items never resolve the session themselves (lint page-authz/session-api-callsite on src/proxies/**)
gate_rules: one feature = one file src/proxies/featureGateRules/\<name\>[.\<fork ID\>].ts `export const rule` { pathPatterns, features?: ["core/<folder>"], enabled: () => boolean, redirectTo? } | tables derived from features (never hand-write table names) | overlap with different redirectTo → first disabled rule by file name, upstream-upstream fails test:feature-gate | no override of upstream rules
always_on: cron task.ts needs `enabled`, cleanup / reconcile registries wrap gated items in `...(flag ? [x] : [])`, always-loaded wiring never imports a gateable feature | fork exceptions → scripts/proxies/alwaysOnExceptions.\<fork ID\>.mjs with a reason per row | test: FEATURE_GATE_CHECK=all pnpm test:feature-gate | ref: src/proxies/README.md
