# DOWNSTREAM NOTICE id:20261106-192912-notices-picked-fixes-and-index
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T19:29:12+09:00
severity: action-required
checkpoint: notices-picked-fixes-and-index
fixes: commit:e56a21e8, 20261103-144217-notice-shipped-index
resolves: 20261105-140157-notices-test-fixes-after-pick, 20261106-162044-shipped-index-backfill-picked-notice
change: (1) test:notices "fixes: の参照先が実在し、履歴上で自分より前のもの" reads every add commit of a notice (git log --full-history; a fork that picked the source has upstream's original add and its own cherry-pick) and accepts the fixes: when any add of the target is an ancestor of the fix's add — a forward-pointing fixes: is still refused, non-picked notices are checked as strictly as before (shippedIndex.mjs fixesPointsBack). (2) shippedIndex.mjs backfill leaves out other repos' notices: on another index, body from: not the own origin, or ledger picked:; new `node scripts/notices/shippedIndex.mjs repair` removes such rows from the own index (idempotent), and the append-only check / verify accept a removed foreign row (own pushed rows still never change)
why: a fork that cherry-picked a notice (hotfix / pick: clean) failed test:notices when the fix of that notice arrived (addCommit followed the TREESAME parent and saw only the fork's cherry-pick), and a fork whose backfill wrote a picked parent notice into its own index failed both ways (keep it = 2 rows once the parent's index carries the id, remove it = edited pushed row)
required_actions:
1. If test:notices reports "<id>: 行が 2 本ある(.notices/shipped/<parent>.md と .notices/shipped/<fork_id>.md)" for a notice you took from a parent: run `node scripts/notices/shippedIndex.mjs repair` once, then commit .notices/shipped/<fork_id>.md (it removes only rows of other repos' notices; nothing to do when it prints "消す行は無い")
2. Remove the matching "known failure" notes from your ledger lines if you kept any for these two checks
verify: pnpm test:notices passes; node scripts/notices/shippedIndex.mjs verify → 一致
manual_steps: -
refs: scripts/notices/shippedIndex.mjs (fixesPointsBack, foreignNoticeIds, repair, backfill, checkAppendOnly) | scripts/notices/notices.test.mjs | .notices/README.md 出荷索引と本文の読み方・修正(fixes) | orders 20261105-140157-notices-test-fixes-after-pick, 20261106-162044-shipped-index-backfill-picked-notice
notes: checked on a disposable clone of oripa-do (60b26f024) with this change applied: the fixes: check passes 20261103-134731-fork-copy-policy-docs → 20261101-134412-fork-extension-policy (it failed before), repair removed only the 20261105-075841-frame-dims-portal-hook row from .notices/shipped/oripa-do.md, then test:notices 13/13 and verify 一致(423 行). Shipped from a separate worktree ahead of the scripts/ reorganisation (legate l1 S12)
