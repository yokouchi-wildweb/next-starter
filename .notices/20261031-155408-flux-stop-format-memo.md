# DOWNSTREAM NOTICE id:20261031-155408-flux-stop-format-memo
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-31T15:54:08+09:00
severity: info
checkpoint: flux-stop-format-memo
change: /flux reports in a new human-facing format (.claude/skills/fmt/flux-stop.md) and keeps its script, identifiers, aligned:/kept_old: lines and resume data in a git-ignored work memo (.flux/memo.md). New skill /fmt holds the formats (brief, ask, flux-stop); .gitignore gains .flux/
why: the old stop report mixed what the human decides on with what the tooling reads. From this checkpoint /flux shows the next segment as six points (changes, UX change, fork follow-up, db:push, downtime, manual data migration), names files by role instead of path, and drops the heavy/light labels; the heavy-segment stop rule now derives from those points
required_actions: none
verify: `pnpm test:flux-relay` passes | the next /flux stop prints no sha, path or notice id in the chat and writes .flux/memo.md
manual_steps: -
refs: .claude/skills/fmt/ (SKILL.md, README.md, brief.md, ask.md, flux-stop.md), .claude/skills/flux/SKILL.md (作業メモ, 重い区間, 軽い区間, 上流への所見, step 2, step 8), .claude/skills/flux/relay.md (中継判定 報告), .claude/skills/flux/moved.md (step 1), .gitignore
notes:
- The /flux you run after merging this segment reports in the new format. Nothing in the fork's code changes
- Ask the agent for identifiers (conflicting files, merge target, notice ids): it answers from .flux/memo.md
- fleet: the worker copies aligned:/kept_old: and the plan from the memo instead of the chat report. PLAN FILE and `<tk> status` keep their shape
- .gitignore: if your fork edited the same region, keep both sides and the `.flux/` line
- No db:push
