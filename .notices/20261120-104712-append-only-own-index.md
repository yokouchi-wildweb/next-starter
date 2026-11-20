# DOWNSTREAM NOTICE id:20261120-104712-append-only-own-index
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-20T10:47:12+09:00
severity: info
checkpoint: hotfix-own-index
hotfix: when the upstream corrects a shipped row of its index (e.g. info -> breaking), every fork that takes that segment fails the append-only check of pnpm check notices / /ship on a row it does not own and cannot clear on its side, so its line stops until it takes this
change: scripts/workflow/notices/shippedIndex.mjs appendOnlyProblems checks only the repo's own index (.notices/shipped/<own repo_id>.md); the parent's indexes (owner is not this repo) are no longer compared with the pushed version, so a rewritten or dropped parent row never fails a fork. The own index is checked as before; when repo.json repo_id cannot be read, every index is checked as before. The rule that a picked-ahead row may vanish from the parent's index is gone with it (checkRows still lets a picked row be missing from the parent's index).
why: a fork had no way to pass its checks after the upstream fixed a shipped row (Canyon line, boardgame-site: user-group-readme-finish row rewritten). This narrow fix goes first (council D349); whether to keep the append-only check at all, and the rule for correcting a shipped notice (allowed; work a fork that already took it must do goes into a new notice with fixes:), are decided later (D348).
required_actions: none
verify: node --test scripts/workflow/notices/shippedIndex.test.mjs passes; pnpm check notices reports no "push 済みの行が変わった・消えた" for rows of .notices/shipped/next-starter.md (or any parent's index)
manual_steps: -
refs: scripts/workflow/notices/shippedIndex.mjs appendOnlyProblems, scripts/workflow/notices/shippedIndex.test.mjs; council 20261106-194813 D348 / D349; order 20261120-095256-notice-body-rewrite-after-ship (left open: it asks the opposite direction, answered with D348)
notes: no fixes: (the append-only check is not a shipped bug of one notice; the policy changes). Rows of your own index stay append-only for now.
