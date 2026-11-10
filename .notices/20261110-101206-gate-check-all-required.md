# DOWNSTREAM NOTICE id:20261110-101206-gate-check-all-required
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/satchel | commit:- (this commit)
date: 2026-11-10T10:12:06+09:00
severity: info
checkpoint: gate-check-all-required
resolves: 20261108-093103-gate-check-all-honor-required, 20261108-170500-gate-route-check-required
change: FEATURE_GATE_CHECK=all in scripts/structure/proxies/featureGate.test.mjs treats the features a fork declared in src/featureGate/required/ (and their dependsOn targets) as open: they are left out of the route / generic-API coverage checks and stay enabled in the two all-closed schema gate tests; every other rule stays strictly checked; upstream (no required/ items) unchanged
why: pnpm ops features set never closes a required feature, so the all-closed checks failed on combinations the fork can never reach (routes importing a required feature, FKs into its tables)
required_actions: none
verify: FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies
manual_steps: -
refs: scripts/structure/proxies/featureGate.test.mjs, src/featureGate/required/README.md, src/featureGate/README.md
notes: forks that kept these failures as known can drop them.
