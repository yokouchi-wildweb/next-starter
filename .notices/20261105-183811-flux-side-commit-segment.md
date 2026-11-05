# DOWNSTREAM NOTICE id:20261105-183811-flux-side-commit-segment
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-scripts-rules.1 | commit:- (this commit)
date: 2026-11-05T18:38:11+09:00
severity: info
checkpoint: flux-side-commit-segment
change: /flux (incoming.mjs + SKILL.md step 5a) finds a segment whose merge target is a side commit (a fix shipped on its break point and merged --no-ff, not picked by this fork) and stops before the merge with the reason and options (pick the fix / ask, e.g. merge the main-line commit instead)
why: merging such a side commit leaves two merge bases with upstream, so the out-of-segment check, ownership:check and the next segment's base break
required_actions: none
verify: -
manual_steps: -
refs: .claude/skills/flux/incoming.mjs | .claude/skills/flux/SKILL.md | .notices/README.md
notes: /flux reads its skill from the upstream tip, so the check applies from the next run. ownership:check is not changed to judge two merge bases (forks pick such fixes)
