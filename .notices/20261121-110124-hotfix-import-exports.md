# DOWNSTREAM NOTICE id:20261121-110124-hotfix-import-exports
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-21T11:01:24+09:00
severity: info
checkpoint: hotfix-import-exports
change: importGaps (hotfixApply.mjs / pickCheck.mjs) also checks that each name a picked file imports from a relative path (`import { a } from "./x"`, `export { a } from "./x"`) is exported by that file in the fork's tree; a missing name gives `gap imports <file>: 先取りしても動かない(./x (a が無い))` (an ES module cannot load without it); a target with `export * from` or unreadable is not checked
why: a pick whose imported file exists but lacks the name (Aurora line on TriQ: the picked compactPlan.mjs imports handoffFile from a lib.mjs that does not export it) reported no gap and /coffee-break stopped on a SyntaxError
required_actions: none
verify: -
manual_steps: -
refs: scripts/workflow/notices/lib.hotfixGaps.mjs | scripts/workflow/notices/hotfixApply.mjs | .claude/skills/flux/SKILL.md
notes: no fork action: /flux and railroad run hotfixApply.mjs at the upstream's tip; the gap row is reported, never a stop (as before)
