# DOWNSTREAM NOTICE id:20261105-110503-setting-test-fork-sections-pick
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle5 | commit:- (this commit)
date: 2026-11-05T11:05:00+09:00
severity: info
checkpoint: setting-test-fork-sections-pick
fixes: 20261031-141531-setting-fields-core-ui
resolves: 20261103-172638-setting-test-fix-notice-fixes-pick
change: the settingStorage.test.ts part of d7665461 (notice 20261103-125547-setting-test-fork-sections) as its own commit, based on the setting-fields-core-ui checkpoint (ca346665) so /flux can pick it right after that segment: test:setting no longer asserts exact key / section lists, so fork-added setting keys and sections pass
why: forks that add their own setting keys / sections failed test:setting twice from setting-fields-core-ui until d7665461 arrived ~40 segments later; the earlier follow-up notice had no fixes:, so /flux could not warn or pick at the broken point
required_actions: none
verify: pnpm test:setting passes at the setting-fields-core-ui segment after the pick, with fork-added keys / sections
manual_steps: -
refs: src/features/core/setting/services/server/settingStorage.test.ts | commit d7665461 | notice 20261103-125547-setting-test-fork-sections | order 20261103-172638-setting-test-fix-notice-fixes-pick
notes: side commit on ca346665 merged --no-ff into main; the change is already on main. A fork already past d7665461 has nothing to apply
