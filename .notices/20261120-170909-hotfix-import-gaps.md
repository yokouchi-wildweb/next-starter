# DOWNSTREAM NOTICE id:20261120-170909-hotfix-import-gaps
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-20T17:09:09+09:00
severity: info
checkpoint: hotfix-import-gaps
change: hotfixApply.mjs (the upstream tip's, run by /flux and railroad for a hotfix pick) reports `gap imports <file> -> <target>` for each relative import of a file it put in that the fork's tree lacks, and one row saying the pick cannot run when every import of that file is missing; `pnpm workflow|ops|check|generate|test` are no longer counted as missing script names (the entry checks cover them)
why: a pick that put in a tool whose imports were left out reported only meaningless rows (scripts test / scripts workflow), not the files it needs
required_actions: none
verify: -
manual_steps: -
refs: scripts/workflow/notices/lib.hotfixGaps.mjs, scripts/workflow/notices/hotfixApply.mjs, .claude/skills/flux/SKILL.md
notes: no fork action: /flux and railroad run hotfixApply.mjs at the upstream's tip
