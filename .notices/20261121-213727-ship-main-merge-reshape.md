# DOWNSTREAM NOTICE id:20261121-213727-ship-main-merge-reshape
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:452f18942
date: 2026-11-21T12:37:27Z
severity: info
checkpoint: ship-main-reshape
change: /ship now runs `pnpm workflow notices catchUp` before every push (step 7, WORKTREE ROUTE, COMMITTED RANGE); catchUp rebuilds a tip that took the push target itself into the work line (first parent = the line, second = the target) as a merge with first parent = the target and second = the line, same tree and author, subject `merge: <branch> を main へ`, and prints `catchUp: 組み直した …` (never a stop)
why: pushed as is, main's first-parent moves to the work side and the previous main line falls onto the second parent (git_shape: main's first-parent is one line); nothing to do on the fork side, the tools come in with this segment
required_actions: none
verify: `git log -1 --format=%s` after a /ship whose tip was such a merge reads `merge: <branch> を main へ` and `git rev-parse HEAD^1` equals the push target
manual_steps: -
refs: scripts/workflow/notices/catchUp.mjs (reshapeTip), .claude/skills/ship/SKILL.md (step 7, WORKTREE ROUTE, CATCH UP), commit 452f18942
notes: a main-into-line merge further down the line (more work committed after it) is not rebuilt by this version; when the target moved past the merged version, catchUp lays the line again as before (the merge is dropped)
