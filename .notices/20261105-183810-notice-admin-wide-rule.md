# DOWNSTREAM NOTICE id:20261105-183810-notice-admin-wide-rule
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-scripts-rules.1 | commit:- (this commit)
date: 2026-11-05T18:38:10+09:00
severity: info
checkpoint: notice-admin-wide-rule
resolves: 20261105-070903-notice-admin-wide-scan-adminroutes
change: /ship notice composition rule: a notice for an admin-wide change must list in required_actions how forks find adminRoutes:false domains and hand-written admin files (git grep for the changed API under src/app/admin, minus files headed "このファイルは dc:generate が生成する" and files equal to upstream), the steps to align them, and verify with pnpm typecheck
why: TriQ hit 3 unplanned failures after an admin-wide notice because its hand-written admin pages for adminRoutes:false domains were not covered by the notice's steps
required_actions: none
verify: -
manual_steps: -
refs: .claude/skills/ship/SKILL.md | .notices/README.md | order 20261105-070903-notice-admin-wide-scan-adminroutes
notes: applies to notices a fork ships itself (middle tiers); nothing to change in fork code
