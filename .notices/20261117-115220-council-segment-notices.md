# DOWNSTREAM NOTICE id:20261117-115220-council-segment-notices
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261106-194813-tooling-ownership-and-growth.1 | commit:- (this commit)
date: 2026-11-17T02:52:20Z
severity: info
checkpoint: council-segment-notices
change: a council's notices follow its segments (checkpoints placed as the forks need, any number per plan sheet), never one notice per sheet: new /ship argument notices:<path,…> (a council's segment drafts → one notice per draft, checkpoint = its segment; with no-push and an empty range the commit holds the notices alone); convoy.md SEGMENT (segment <label> notices:<path>: the Convoy writes a segment's notice on its line after the loads, not pushed); DEPART takes no notices: any more; the convoy no longer says "never a safe point" (a safe point only as /ship's own rules make one); /quest under a commission carries notice_material: resolves: <id> whenever /ship found one
why: the notice / checkpoint / flux rules are the framework's core and the team tools follow them as they are (the council's decisions D237 / D238; D239 S1 S2 S4 S6 S17)
required_actions: none
verify: pnpm check skills
manual_steps: -
refs: .claude/skills/ship/SKILL.md (args notices:, step 5), .claude/skills/quest/convoy.md (SEGMENT, DEPART), .claude/skills/quest/SKILL.md (steps 5-6)
notes: fixes the wording of 20261116-222954-quest-council-notice (one plan sheet = one notice) without changing what forks run; the team tools that send these cues ship with their switch
