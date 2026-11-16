# DOWNSTREAM NOTICE id:20261116-222954-quest-council-notice
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261106-194813-tooling-ownership-and-growth.1 | commit:- (this commit)
date: 2026-11-16T22:29:54Z
severity: info
checkpoint: quest-council-notice
change: a quest under a council commission (its order's body has a commission: line) writes no notice of its own: /quest ships it with /ship --quick no-push notice:council (new /ship argument: steps 3-4 judge, step 5 writes nothing, the report lists the material) and puts notice_material: lines in its answer draft; the council's tool takes them into the plan sheet's one notice. convoy.md DEPART: depart notices:<path,…> = the council's drafts, the departure's /ship writes one notice per draft with every item
why: one plan sheet = one ship = one notice (the council's decision D229): each quest's own notice made three notices for one sheet
required_actions: none
verify: pnpm check skills
manual_steps: -
refs: .claude/skills/quest/SKILL.md (steps 5-7), .claude/skills/quest/convoy.md (DEPART 3), .claude/skills/ship/SKILL.md (args notice:council, step 5, report)
notes: quests without a commission (single quests, a session's own) ship their notice as before; the team tools that send notices: ship with their switch
