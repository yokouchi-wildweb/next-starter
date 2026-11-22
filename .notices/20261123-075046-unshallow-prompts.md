# DOWNSTREAM NOTICE id:20261123-075046-unshallow-prompts
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:78263f854
date: 2026-11-22T22:50:46Z
severity: info
checkpoint: unshallow-prompts
change: /fork-init and /flux run git fetch --unshallow on a shallow clone and go on, instead of proposing it and waiting for the user
why: the question guarded nothing (D437): the fetch only adds history, removes nothing and sends nothing out
required_actions: none
verify: pnpm check skills
manual_steps: -
refs: .claude/skills/fork-init/SKILL.md (rules, step 2), .claude/skills/flux/SKILL.md (step 5)
notes: /flux still stops when the fetch fails (then the user confirms the inherited range) and never treats everything as inherited on its own.
