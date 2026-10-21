# DOWNSTREAM NOTICE id:20261021-133822-guest-login-feature-gate
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-21T13:38:22+09:00
severity: action-required
checkpoint: guest-login-feature-gate
change: The demo-login feature-gate rule in src/config/app/feature-gate.config.ts now also closes `POST /api/auth/guest-login` (pathPatterns: ["/demo-login", "/api/auth/guest-login"], enabled: APP_FEATURES.demo.login). With `APP_FEATURES.demo.login = false` the API now returns 404; with true (upstream default) nothing changes.
why: only the /demo-login page was gated, so a fork that turned demo login off still let anyone create a demo user and get a demo session cookie by calling the API directly. Found by council 20261021-125505-paired-device-review (a demo session made any device write via createDeviceRoute silently skipped before 85fa0491).
required_actions:
1. Merge upstream (src/config/app/feature-gate.config.ts: take upstream's demo-login rule; keep any fork-owned rules / flag values).
2. If the fork has `APP_FEATURES.demo.login = false`: search the fork for direct callers of `/api/auth/guest-login` or `demoLogin` / `useDemoLogin` outside src/app/(user)/(auth)/demo-login (e.g. a custom "try as guest" button). If any exist, either set `APP_FEATURES.demo.login = true` or remove those callers.
verify: `pnpm test:feature-gate` passes; with `APP_FEATURES.demo.login = false`, `curl -i -X POST http://localhost:3000/api/auth/guest-login` returns 404 (ask the user to run it against their dev server).
manual_steps: -
refs: src/config/app/feature-gate.config.ts (demo-login rule), src/app/api/auth/guest-login/route.ts, src/proxies/README.md
notes: Upstream callers checked: only src/app/(user)/(auth)/demo-login (gated by the same flag) uses the API. Forks: not checked.
