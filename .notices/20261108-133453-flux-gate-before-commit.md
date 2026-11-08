# DOWNSTREAM NOTICE id:20261108-133453-flux-gate-before-commit
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-08T13:34:53+09:00
severity: info
checkpoint: flux-gate-before-commit
change: /flux checks the next-segment gate twice — before the segment commit (end of step 6: follow-up, data fixes, checks, kept items) and at the segment end after push — and states how to repair a gap found after push (extra commit in the same segment, rerun the segment check and the ownership check, push, recheck; pushed ledger rows are not rewritten)
why: a scenario check of the skill showed leftovers were found only after push, and the repair path was not written
required_actions: none
verify: -
manual_steps: -
refs: .claude/skills/flux/SKILL.md (次の区間へ進む条件, 手順 6)
notes: /flux reads its skill from the upstream tip, so this applies from the next run
