# DOWNSTREAM NOTICE id:20261116-132435-quest-convoy-skill
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261106-194813-tooling-ownership-and-growth.1 | commit:- (this commit)
date: 2026-11-16T04:24:35Z
severity: info
checkpoint: quest-convoy-skill
change: the quest load / depart procedure .claude/skills/quest/caravan.md is renamed convoy.md (the loading role is now the Convoy; the team tool is the caravan); /quest and /ship point at convoy.md; .notices/README.md's safe point line names the tag by repo.json repo_id (safePoint already reads it) and no longer ties --safe to who ships (a team's ship is a plain /ship, --safe only when asked)
why: the team tools renamed their quest tool to caravan and its loading role Caravan to Convoy (one name per role); the safe point stays /ship's own call whoever ships
required_actions: none
verify: pnpm check notices
manual_steps: -
moved: .claude/skills/quest/caravan.md -> .claude/skills/quest/convoy.md
refs: .claude/skills/quest/convoy.md, .claude/skills/quest/SKILL.md, .claude/skills/ship/SKILL.md (WHEN TO USE, COMMITTED RANGE), .notices/README.md (セーフポイント)
notes: the team tools that read convoy.md ship with their switch; a fork whose team tools still name caravan.md keeps working only until it takes this notice
