# DOWNSTREAM NOTICE id:20261110-100118-lib-config-tests-fork-values
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/satchel | commit:- (this commit)
date: 2026-11-10T10:01:18+09:00
severity: info
checkpoint: lib-config-tests-fork-values
fixes: 20261109-002053-lib-drizzle-pool-config, 20261108-205554-http-default-timeout
resolves: 20261110-094607-lib-config-tests-fork-override-independent
change: lib config tests (drizzle, httpDefaults, toast, jwt, spamGuard, frameDims) check the upstream defaults via <name>ConfigDef.compose({}) instead of the loaded @lib-config override; frameDimsConfigDef is now exported
why: a fork that wrote its own values into src/config/lib/<name>.config.ts (as the notices tell it to) failed pnpm test src/lib/<name>, the verify step of those notices
required_actions: none
verify: pnpm test src/lib/drizzle src/lib/httpDefaults src/lib/toast src/lib/jwt src/lib/spamGuard src/lib/frameDims passes with your own values in src/config/lib/
manual_steps: -
refs: src/lib/drizzle/config.test.ts, src/lib/httpDefaults/httpDefaults.test.ts, src/lib/toast/config.test.ts, src/lib/jwt/config.test.ts, src/lib/spamGuard/config.test.ts, src/lib/frameDims/useFrameDimsStyle.test.ts, src/lib/frameDims/config.ts
notes: tests only; no config shape change. A fork that kept those test failures as known can drop them.
