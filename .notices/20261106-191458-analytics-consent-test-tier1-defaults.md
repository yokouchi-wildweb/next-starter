# DOWNSTREAM NOTICE id:20261106-191458-analytics-consent-test-tier1-defaults
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T19:14:58+09:00
severity: info
checkpoint: analytics-consent-test-tier1-defaults
fixes: 20261105-070608-analytics-opt-in-consent
resolves: 20261106-155420-analytics-consent-test-fork-values
change: test:analytics-consent checks the upstream default values of src/config/app/analytics.config.ts (enabled: false / consent: "required") on Tier1 only (readForkIdentity(...).isTier1, as the setting / wiring tests); in forks that test is skipped with a reason; the behaviour tests (gating, consent subscription, init) still run on every tier
why: a fork that set enabled: true / consent: "notRequired" as 20261105-070608 step 3 asks failed this test forever
required_actions: none
verify: pnpm test:analytics-consent passes (in a fork: 5 pass, 1 skipped "上流の既定の値の検査（Tier1 だけ）")
manual_steps: -
refs: src/lib/analyticsConsent/consent.test.ts | order 20261106-155420-analytics-consent-test-fork-values
notes: no change to the config values or to analytics behaviour
