# DOWNSTREAM NOTICE id:20261126-190730-role-ops-test-fork-tier
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261126-190439-role-ops-test-fork-tier | commit:- (this commit)
date: 2026-11-26T19:07:30+09:00
severity: info
checkpoint: role-ops-test-fork-tier
fixes: commit:1b910b565
pick: -
resolves: 20261126-184001-role-ops-test-fork-tier
change: scripts/structure/role/tests/ops.test.mjs writes a Tier1 repo.json (repo_id = the first section of the copied src/lib/CATALOG.md, tier root) into its temp copies instead of using the repo's own repo.json, so the role tools run as Tier1 there whatever the repo's tier; the fork-side test keeps its own child / leaf repo.json
why: in a fork the copied repo.json is tier leaf and the temp copy has no git, so since 1b910b565 toggleRole / generate / deleteRole stopped with 親の持ち物か見分けられないので書きません(親の remote が無い…) and 4 tests failed in every fork (pnpm test, /sluice --safe; boardlist could not make its safe point)
required_actions: none (take the segment; the test passes in a fork)
verify: in a fork (repo.json tier leaf): pnpm test scripts/structure/role/tests/ops.test.mjs passes
manual_steps: -
refs: scripts/structure/role/tests/ops.test.mjs (writeTier1RepoJson), scripts/structure/role/rolePaths.mjs (parentOwns), src/lib/forkOwnership/forkIds.mjs (catalogSectionNames, isTier1)
notes: test-only change; the role tools are unchanged
