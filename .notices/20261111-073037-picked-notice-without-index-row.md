# DOWNSTREAM NOTICE id:20261111-073037-picked-notice-without-index-row
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(this commit)
date: 2026-11-10T22:30:37Z
severity: action-required
checkpoint: picked-notice-without-index-row
fixes: 20261105-081445-pick-ignores-shipped-index
change: pnpm check notices accepts a notice body this fork picked ahead (ledger picked:) with no row yet in an ancestor's shipped index, and a row once hand-added there may disappear; /flux takes the upstream side of an ancestor's shipped index on a segment-merge conflict
why: a hotfix pick takes the fork side of .notices/shipped/ (pick-ignores-shipped-index), but the check then failed on the body without its row, so forks hand-added the row under a temporary permit, and a later segment merge conflicted on it again and dropped it (railroad Horizon F3)
required_actions:
1. If .notices/shipped/<ancestor>.md has a row you added by hand for a notice your ledger marks picked: (find it: git diff $(git merge-base HEAD <upstream>/<branch>) HEAD -- .notices/shipped/), put back the version of your last merged upstream point: git checkout $(git merge-base HEAD <upstream>/<branch>) -- .notices/shipped/<ancestor>.md, then commit (not the upstream tip: it carries rows of segments you have not taken).
2. Drop the temporary permit lines for that file in .fork-ownership/<fork_id>.permits.txt whose upreq: names an order filed only to cover that hand-added row; if the same order covers other files, keep their lines and remove only the index line.
3. From now on, on a conflict in an ancestor's .notices/shipped/<ancestor>.md during a segment merge, take the upstream side (git checkout --theirs -- <path>); never add or keep a row by hand.
verify: pnpm check notices passes; pnpm workflow ownership check exit 0 (no violation on .notices/shipped/)
manual_steps: -
refs: scripts/workflow/notices/shippedIndex.mjs (checkRows picked, appendOnlyProblems), .claude/skills/flux/SKILL.md step 5c and HOTFIX execute 1, .claude/skills/flux/railroad.md INTAKE 3, .notices/README.md 出荷索引は pick の外
notes: no change for a fork that never picked a notice ahead. boardgame-site: .notices/shipped/next-starter.md has the hand-added row of 20261110-213606-ship-safe-points under permit upreq:20261110-215010-hotfix-pick-permit-debt (its order also covers two other files). Other forks not checked.
