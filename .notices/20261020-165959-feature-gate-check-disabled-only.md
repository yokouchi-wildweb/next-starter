# DOWNSTREAM NOTICE id:20261020-165959-feature-gate-check-disabled-only
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-20T16:59:59+09:00
severity: info
checkpoint: feature-gate-check-disabled-only
change: `pnpm test:feature-gate` now checks route coverage (routes / _screen / _components and generic /api/<domain> that import a gated domain) only for rules whose `enabled` is false, and runs the "all features disabled" schema-gate tests only with `FEATURE_GATE_CHECK=all` (upstream's mode). The previous notice 20261020-170000-feature-gate-schema-gate step 5 is rewritten accordingly. No config shape or runtime change.
why: a fork whose product is built on a gated feature (coin economy: wallet / payment / coupon always on) had dozens of legitimate routes reported as "not closed", and fork tables referencing gated tables (e.g. direct_sale_orders → purchase_requests) failed the all-disabled test, although nothing breaks while the feature is on. The hazard (route open while its tables are absent) only exists when the flag is false, so that is now the only case checked.
required_actions:
1. Merge upstream (src/proxies/featureGate.test.mjs, src/proxies/README.md: take upstream's version).
2. Run `pnpm test:feature-gate`. Forks that keep every gated flag true: it passes with no fork change (no declaration, no exception list). Forks with a flag false: for each reported route / FK, add a fork-owned rule to `featureGateRules` in src/config/app/feature-gate.config.ts with the same flag as `enabled` (`{ pathPatterns: [...], tables: [...], enabled: APP_FEATURES.<flag> }`) or guard the caller with the flag. Never append fork paths / tables to upstream rules.
3. If the fork already added fork paths / tables to an upstream rule while applying 20261020-170000 step 5, move them into a fork-owned rule as in step 2 (or delete them if the flag is true and stays true).
verify: `pnpm test:feature-gate` passes (2 tests reported as skipped "FEATURE_GATE_CHECK=all のときだけ実行"); `git diff <upstream>/main -- src/config/app/feature-gate.config.ts` shows only appended fork rules or changed flag values, no edits inside upstream rules.
manual_steps: -
refs: src/proxies/featureGate.test.mjs (CHECK_ALL), src/proxies/README.md (決まりごと / fork での使い方), upstream-request 20261020-165507-feature-gate-required-features-for-forks
notes: Turning a gated feature off later makes the test list every fork route / FK depending on it, which is the guard against switching off a feature the fork's product needs; no "required" declaration exists by design. oripa-do: requested this; repository not re-checked against the new test (its merge from 6220a78d is on hold).
