# DOWNSTREAM NOTICE id:20261102-220346-hotfix-pick-checks
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:tools/hotfix-pick-checks | commit:(this commit)
date: 2026-11-02T22:03:46+09:00
severity: info
checkpoint: hotfix-pick-checks
change: the /flux hotfix pick no longer halts on pnpm ownership:check when the fork has no such check (skipped) or an older one (run, result recorded, not a stop); /ship hotfix gains pnpm notices:hotfix-check
why: a pick has no merge target, so step 7c's skip rule did not apply and forks far behind had no defined behavior (fleet sortie 20261101-135551); the new behavior matches the fleet worker's rule for missing or older tools
required_actions: none
verify: pnpm test:notices
manual_steps: -
refs: .claude/skills/flux/SKILL.md, .claude/skills/ship/SKILL.md, scripts/notices/hotfixCheck.mjs, .notices/README.md
notes: normal segments keep step 7c as before. notices:hotfix-check is an upstream (shipping side) check; a fork that ships hotfixes to its own downstream uses it the same way.
