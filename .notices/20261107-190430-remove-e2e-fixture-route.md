# DOWNSTREAM NOTICE id:20261107-190430-remove-e2e-fixture-route
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-07T19:04:30+09:00
severity: action-required
checkpoint: remove-e2e-fixture-route
change: The test-only route src/app/e2e/** (unsaved-guard fixture screens /e2e/unsaved-guard, /form, /table, /target), its feature-gate rule e2eFixtures (src/featureGate/rules/e2eFixtures.ts, FeatureName "e2eFixtures") and the config key APP_FEATURES.e2e (e2e.fixtures) are removed. tests/e2e/unsavedGuard/unsavedGuard.spec.ts now drives real screens (admin sample-tag edit, /demo/tables EditableGridTable, admin sample data import, admin sample sort), logs in as the `pnpm task dev-admin` admin (password from AUTH_JWT_SECRET in ENV_FILE, default .env.development) and skips with a reason when the dev server / login / rows are missing; it skips while sampleDomain or demoPages is closed. tests/e2e/featureGate.ts skipWhileClosed stays (message no longer mentions fixtures).
why: src/app's top level holds only curated areas ((user), (marketing), admin, debug, api); a route that exists only for one feature's tests breaks that layering and was shipped to every fork, which could not remove it.
required_actions:
1. Merge upstream up to this checkpoint. If git reports a conflict in src/config/app/app-features.config.ts around `e2e: { fixtures: … }`, take upstream's side (the whole `e2e` block is gone). Then `git grep -n -E "e2eFixtures|APP_FEATURES\.e2e|e2e\.fixtures" -- src tests scripts` must be empty: remove each fork reference (a fork's own skipWhileClosed("e2eFixtures") → skip on the rule that closes the real screen the fork's spec uses, or drop the call).
2. If the fork added its own screens under src/app/e2e/ (`git ls-files src/app/e2e`): move each test to a real screen of the app (do not keep a test-only route), delete src/app/e2e/, then run `pnpm routes:map` and `pnpm extensions:generate`.
3. A fork without either does nothing beyond the merge.
verify: pnpm typecheck | pnpm extensions:check | FEATURE_GATE_CHECK=all pnpm test:feature-gate | pnpm test:route-map | `git ls-files src/app/e2e` is empty | optional: `pnpm task dev-admin`, start a dev server, `E2E_BASE_URL=http://localhost:<port> pnpm test:e2e:unsaved-guard`
manual_steps: -
refs: tests/e2e/unsavedGuard/README.md, src/lib/unsavedGuard/README.md, order 20261107-113259-remove-e2e-fixture-route (HQ council 20261030-212344)
notes: Deleted (no move target): src/app/e2e/unsaved-guard/** (14 files: page.tsx / _screen of start, form, table, target) and src/featureGate/rules/e2eFixtures.ts; their route-map rows and the generated rules.ts entry go away by regeneration. The unsaved guard's behavior is unchanged.
