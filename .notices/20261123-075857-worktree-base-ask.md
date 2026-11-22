# DOWNSTREAM NOTICE id:20261123-075857-worktree-base-ask
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:cab5c905d
date: 2026-11-22T22:58:57Z
severity: info
checkpoint: worktree-base-ask
change: the /worktree skill no longer asks the user when unsure about a new worktree's base: the default stays the current HEAD, and a request that should branch from main adds --from main
why: the question guarded nothing (D437): a wrong base only means recreating the branch, nothing is lost
required_actions: none
verify: pnpm check skills
manual_steps: -
refs: .claude/skills/worktree/SKILL.md (NEW 2)
notes: -
