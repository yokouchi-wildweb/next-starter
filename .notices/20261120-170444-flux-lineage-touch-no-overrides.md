# DOWNSTREAM NOTICE id:20261120-170444-flux-lineage-touch-no-overrides
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-20T17:04:44+09:00
severity: info
checkpoint: flux-lineage-touch-no-overrides
change: /flux step 5a's lineage-touch.mjs (the upstream tip's) answers 0 before reading repo_id when the fork's tree has no .claude/rules/lineage.md and its project.md has no overrides: line; a fork without repo.json no longer stops with exit 2 at its first segment
why: the check read repo_id first, so an old fork without repo.json stopped /flux at 5a even though it has no override to touch
required_actions: none
verify: -
manual_steps: -
refs: .claude/skills/flux/lineage-touch.mjs, .claude/skills/flux/lineage-touch.test.mjs
notes: no fork action: /flux reads lineage-touch.mjs at the upstream's tip
