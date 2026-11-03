# DOWNSTREAM NOTICE id:20261103-125547-setting-test-fork-sections
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-03T12:55:47+09:00
severity: info
checkpoint: setting-test-fork-sections
resolves: 20261101-192954-setting-test-fork-sections
change: pnpm test:setting now runs in forks: behavior checks run on every tier; exact upstream key / section lists and default values run on Tier1 only (readForkIdentity isTier1). In a fork it checks that the upstream keys and sections are still present in order, that upstream keys stay non-public, and that sections are sorted by order; fork sections, fork keys (public or not) and fork keys inside upstream sections are accepted.
why: The test hardcoded ["general","maintenance"] and the upstream key lists, so it failed in every fork that adds a setting section or key, and a fork cannot edit a core test.
required_actions: none
verify: `pnpm test:setting` (one skip is expected in a fork)
manual_steps: -
refs: src/features/core/setting/services/server/settingStorage.test.ts
notes: Checked on a scratch copy shaped like a fork (fork_id acme, a section shop.acme.ts and a public key shopOpen.acme.ts in the maintenance section): new test 10 pass / 1 skip, the old test failed 2. Not run on a real fork. Forks that noted this failure in a ledger line can drop that note.
