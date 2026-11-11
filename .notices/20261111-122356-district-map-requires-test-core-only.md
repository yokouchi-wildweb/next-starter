# DOWNSTREAM NOTICE id:20261111-122356-district-map-requires-test-core-only
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/akatsuki/o/20261110-135029-district-map-requires-test-fork-domains | commit:- (this commit)
date: 2026-11-11T12:23:56+09:00
severity: info
checkpoint: district-map-requires-test-core-only
fixes: 20261108-152849-config-district-map
resolves: 20261110-135029-district-map-requires-test-fork-domains
change: scripts/structure/district-map/districtMap.test.mjs "requires" test pins only core domains' requires; business domains' requires are checked empty on Tier1 only
why: the test pinned upstream's whole requires list, so a fork adding requires to its own domains (per the foreign-key check of feature-gate-foundation) always failed it
required_actions: none
verify: pnpm test scripts/structure/district-map/districtMap.test.mjs passes with requires on your own business domains
manual_steps: -
refs: scripts/structure/district-map/districtMap.test.mjs, src/lib/forkOwnership/forkIds.mjs (readForkIdentity)
notes: a fork that edited this test locally to pass may return it to upstream's text
