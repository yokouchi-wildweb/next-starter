# DOWNSTREAM NOTICE id:20261110-154000-user-frame-test-tier1-only
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/riddle | commit:- (this commit)
date: 2026-11-10T15:40:00+09:00
severity: info
checkpoint: user-frame-test-tier1-only
resolves: 20261110-130302-user-frame-test-tier1-only
change: no code in this commit. The fix is upstream commit 59afa3a1d (already on main): the 上流の宣言 test in src/app/(user)/_layout/UserFrame.test.tsx skips when readForkIdentity(repo).isTier1 is false, so a fork with its own (user)/frame.override.ts (or frame.ts) no longer fails it. data-slot, wiring and SP toggle tests still run in every tier. This notice only carries the resolves: line for the order.
why: the order came from a downstream fork; its temporary permits on that order expire with this resolve
required_actions: none
verify: pnpm test 'src/app/(user)/_layout' passes (the 上流の宣言 test reports skipped in a fork)
manual_steps: -
refs: commit:59afa3a1d, src/app/(user)/_layout/UserFrame.test.tsx, order 20261110-130302-user-frame-test-tier1-only
notes: no db:push.
