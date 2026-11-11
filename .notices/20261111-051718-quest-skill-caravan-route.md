# DOWNSTREAM NOTICE id:20261111-051718-quest-skill-caravan-route
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-10T20:17:18Z
severity: info
checkpoint: quest-skill-caravan-route
change: new skill /quest (work one order to a commit with no human round trip: take, work, /ship --quick no-push, answer draft) with caravan.md (load quest commits onto one branch, depart with /ship --safe, answer the orders); /ship gains COMMITTED RANGE (ship commits already made when nothing is uncommitted) and WORKTREE ROUTE (the HQ D176 push `git push origin HEAD:main` from a linked worktree, now for every ship mode, not only --quick)
why: quests are many small orders: one full check and one push per batch instead of per order (the quest team tool's Seeker / Caravan run these skills); forks get the same skills by merge
required_actions: none
verify: pnpm check skills
manual_steps: -
refs: .claude/skills/quest/SKILL.md, .claude/skills/quest/caravan.md, .claude/skills/ship/SKILL.md (WHEN TO USE, step 1, step 7, WORKTREE ROUTE, COMMITTED RANGE)
notes: behavior change for /ship in a linked worktree: a branch with no upstream of its own (or tracking origin/main) now pushes with `git push origin HEAD:main` in plain and --safe ships too; a branch tracking its own remote branch pushes as before. Nothing to do on the fork side.
