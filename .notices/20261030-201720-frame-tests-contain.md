# DOWNSTREAM NOTICE id:20261030-201720-frame-tests-contain
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-30T20:17:20+09:00
severity: info
checkpoint: frame-tests-contain
fixes: commit:5f91d666
resolves: 20261030-192850-userparts-test-config-independent
change: test:user-layout and test:frame-controls now check the guarded contract (data-frame-part, data-frame-root, Hide* marks, --app-bottom-nav-height wiring, item ids / order) by containment on every tier. The BottomNav snapshot with text-accent is gone (the expected active class comes from ACTIVE_COLOR_TYPE). Whole-HTML comparisons of Header and the outer frame run on Tier1 only.
why: A fork that changed ACTIVE_COLOR_TYPE (an allowed config edit) or added harmless markup failed these tests permanently, which hid real regressions in the same tests.
required_actions: none
verify: `pnpm test:user-layout` and `pnpm test:frame-controls` pass; a failure now means a guarded mark or attribute is missing. Drop any "known failure" note you kept for these tests.
manual_steps: -
refs: src/app/(user)/_layout/UserParts.test.tsx, src/app/(user)/_layout/UserLayout.test.tsx, src/components/AppFrames/User/controls/frameControls.test.tsx, order 20261029-183757-frame-tests-contain-not-equal
notes: Tests only, no runtime change. boardgame-site reported these failures (order filed from that repo); other forks not checked.
