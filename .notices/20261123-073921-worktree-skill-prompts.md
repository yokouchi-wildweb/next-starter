# DOWNSTREAM NOTICE id:20261123-073921-worktree-skill-prompts
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:7b98732de
date: 2026-11-22T22:39:21Z
severity: info
checkpoint: worktree-skill-prompts
change: the /worktree skill no longer waits for the user before creating with a proposed branch name, before removing a worktree whose branch is not merged into main, or before deleting a merged branch after remove
why: the three questions guarded nothing (D437): remove keeps the branch and its commits (scripts/workflow/worktree/README.md), and git branch -d refuses an unmerged branch
required_actions: none
verify: pnpm check skills
manual_steps: -
refs: .claude/skills/worktree/SKILL.md (NEW 1, REMOVE 1-2)
notes: still stops: uncommitted changes on remove (work would be lost) and SYNC --force (hand edits of env files would be overwritten). REMOVE step 3 was folded into step 2.
