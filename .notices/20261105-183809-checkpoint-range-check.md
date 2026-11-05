# DOWNSTREAM NOTICE id:20261105-183809-checkpoint-range-check
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-scripts-rules.1 | commit:- (this commit)
date: 2026-11-05T18:38:09+09:00
severity: info
checkpoint: checkpoint-range-check
resolves: 20261104-143340-ship-check-branch-checkpoints-on-main
change: new scripts/notices/checkpointCheck.mjs <from>..<to>: checks every checkpoint in a range on the tree a fork really has at that segment (checkpoints in /flux order, each merged in turn from <from>; side branches get the main-first merged tree) with typecheck, test:config-module-load, test:core-rules, registry:check; stops at the first broken one. /ship runs it before a push whose range has checkpoints before the tip. Rule: unpushed own commits may be fixed freely (amend / rebase, notice and index row included); fixes: notices are only for pushed ones
why: /ship checked only the tip, so the fieldtype checkpoints shipped broken (typecheck from fieldtype-list-presenter-for, registry:check from fieldtype-shared-table) and halted 3 fleet forks
required_actions: none
verify: pnpm test:notices
manual_steps: -
refs: scripts/notices/checkpointCheck.mjs | .claude/skills/ship/SKILL.md | .notices/README.md | order 20261104-143340-ship-check-branch-checkpoints-on-main
notes: forks that ship notices (middle tiers) get the same /ship step. The registry:check break at the fieldtype checkpoints is fixed by 20261105-182849-fieldtype-registry-display-pick, the typecheck one by 20261105-110501-presenterfor-readonly-pick
