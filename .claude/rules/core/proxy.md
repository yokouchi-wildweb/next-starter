---
paths:
  - "src/proxy.ts"
  - "src/proxies/**"
  - "src/config/app/feature-gate.config.ts"
---
# PROXY
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

entry: src/proxy.ts | handler chain in src/proxies/index.ts: each ProxyHandler returns Response (intercept) or void (pass) → fallback NextResponse.next() | order matters: maintenanceProxy → demoModeProxy → featureGateProxy → redirectProxy | x-pathname: proxy.ts sets it on request headers → server components read headers().get("x-pathname")
add: handler = src/proxies/\<name\>.ts + register in index.ts | decorator (side effect such as a cookie on pass-through, skipped when a handler intercepts) = register in proxyResponseDecorators | in a fork, registering edits core index.ts → approval + fork_core_edit_compat (append, keep upstream entries)
