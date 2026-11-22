# DOWNSTREAM NOTICE id:20261122-150347-ship-commit-split
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-22T15:03:47Z
severity: info
checkpoint: ship-commit-split
change: the /ship skill is split into three files with the same text: .claude/skills/ship/commit.md (steps 0, 1, 3-6 and QUICK SHIP), .claude/skills/ship/notice.md (NOTICE COMPOSITION), .claude/skills/ship/SKILL.md (the flow: steps 2, 7, 8, STOP CASES, WORKTREE ROUTE, CATCH UP, SHIPPED TIP, COMMITTED RANGE, CLEANING UP, and ATTACHED FILES pointing to the two) | a caller that only commits (`/ship --quick no-push`) reads commit.md, plus notice.md when it writes a notice | .claude/skills/flux/relay.md points to notice.md for NOTICE COMPOSITION
why: SKILL.md (42 955 chars) was read whole per order by callers that only commit; 80% of it was not theirs | your own docs or tools that point to a moved section of ship/SKILL.md would point to nothing
required_actions: none
verify: `git grep -n -e 'ship/SKILL.md' -- ':!.notices' ':!docs/journal'` lists no pointer to NOTICE COMPOSITION, QUICK SHIP or steps 0, 1, 3-6 in ship/SKILL.md
manual_steps: -
refs: .claude/skills/ship/SKILL.md ATTACHED FILES | .claude/skills/ship/commit.md | .claude/skills/ship/notice.md | .claude/skills/flux/relay.md RELAY NOTICE COMPOSITION
notes: the skill is upstream-owned; the split arrives with the merge | your own docs or tools that point to sections of .claude/skills/ship/SKILL.md that moved (NOTICE COMPOSITION, QUICK SHIP, steps 0, 1, 3-6): point them to commit.md / notice.md (find them with the verify grep) | a pointer to SKILL.md as the whole skill stays as it is
