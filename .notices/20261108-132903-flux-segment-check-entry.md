# DOWNSTREAM NOTICE id:20261108-132903-flux-segment-check-entry
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-08T13:29:03+09:00
severity: info
checkpoint: flux-segment-check-entry
change: /flux's per-segment check (step 6, also used by pick and hotfix) now runs the upstream check entry pnpm check --gate=ship first, then pnpm typecheck and eslint on the segment's changed files; a segment whose merged tree has no scripts/runner/gates/ skips the entry and says so; a failed target is compared at the pre-merge HEAD by name (pnpm check <target>)
why: checks upstream adds to pnpm check (HQ D88: one upstream-owned check entry for /ship and /flux) must also run in each fork at intake
required_actions: none
verify: -
manual_steps: -
refs: .claude/skills/flux/SKILL.md (手順 6 区間の検査) | scripts/runner/gates/README.md | .claude/skills/ship/SKILL.md
notes: /flux reads its skill from the upstream tip, so this applies from the next run. The ownership check (step 7c) is unchanged and still runs separately
