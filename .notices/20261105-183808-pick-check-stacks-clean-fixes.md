# DOWNSTREAM NOTICE id:20261105-183808-pick-check-stacks-clean-fixes
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-scripts-rules.1 | commit:- (this commit)
date: 2026-11-05T18:38:08+09:00
severity: info
checkpoint: pick-check-stacks-clean-fixes
change: pnpm notices:pick-check now stacks, before trying a fix on its break point, every shipped pick:clean fix of another notice whose own base is that break point or earlier (in history order, the tree /flux really has there). Candidates come from the shipping tip's index (--at, default HEAD), so side-commit fixes count too. The stacked fixes show in the output; index rows get no new field
why: a fix whose break point is also broken by another notice's clean fix was judged pick:- (the feature-map fix had to carry the presenterFor lines itself). Forks that ship notices themselves (middle tiers) run this tool in their own /ship
required_actions: none
verify: pnpm test:notices
manual_steps: -
refs: scripts/notices/pickCheck.mjs | .notices/README.md | .claude/skills/ship/SKILL.md
notes: no change to forks' /flux (it already picks clean fixes in history order). Re-judging the three shipped clean fixes kept them clean
