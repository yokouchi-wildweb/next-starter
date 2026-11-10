# DOWNSTREAM NOTICE id:20261110-171921-gate-open-baseline
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-10T17:19:21+09:00
severity: info
checkpoint: config-gate-open-baseline
change: e2e skip decision (tests/e2e/featureGate.ts skipWhileClosed) now reads the same answer as the server: ruleList rules = rule values + the open switch FEATURE_GATE_OPEN + dependsOn (was configEnabled, rule values only) | playwright.config.default.ts loads the dev env file (ENV_FILE, default .env.development, never overriding env already set) so the runner sees the same FEATURE_GATE_OPEN / APP_ENV as the dev server | src/featureGate/README.md「全開スイッチ」 and .env.example: upstream (Tier1) development keeps FEATURE_GATE_OPEN=all because upstream will ship its add-on features closed (D115, next notice); route-map gatedOff and cron keep reading rule values | the unread-notification modal in the user frame already checks the notification feature (no change)
why: after upstream closes its add-on features, e2e specs of closed screens would be skipped on Tier1 even with the server opened by the switch; with an empty switch a db:push would propose dropping the closed features' tables
required_actions: none
verify: pnpm e2e --list still lists the specs | with FEATURE_GATE_OPEN empty the skip decision equals the rule values as before
manual_steps: -
refs: src/featureGate/README.md, tests/e2e/unsavedGuard/README.md, council 20261023-175358-config-redesign decisions D31 D105 D115 L1.49, legate:l1 order 52
notes: forks keep FEATURE_GATE_OPEN empty (their own switches.config.ts decides); a fork's own playwright.config.ts that reads the .default gets the env loading too.
