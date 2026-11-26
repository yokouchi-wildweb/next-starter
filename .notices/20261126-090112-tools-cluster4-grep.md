# DOWNSTREAM NOTICE id:20261126-090112-tools-cluster4-grep
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261126-085945-tools-cluster4-grep-pattern | commit:- (this commit)
date: 2026-11-26T09:01:12+09:00
severity: info
checkpoint: tools-cluster4-grep
resolves: 20261125-203129-tools-cluster4-grep-pattern
change: notice 20261125-142536-tools-cluster4 required_actions 2: the grep alternative parsePending is now \bparsePending\b, so it no longer hits upstream's parsePendingPrompt (scripts/operations/db) — the other steps are unchanged
why: a fork running the step as written got 13 upstream hits (parsePendingPrompt) that are not its own call sites
required_actions: none
verify: git grep -n -E '\bparsePending\b' -- . ':!.notices' prints only your own call sites (none in upstream)
manual_steps: -
refs: .notices/20261125-142536-tools-cluster4.md (required_actions 2) | scripts/operations/db/lib.pendingPrompt.ts | order 20261125-203129-tools-cluster4-grep-pattern
notes: a fork that already took tools-cluster4 and saw only parsePendingPrompt hits for that word has nothing to do
