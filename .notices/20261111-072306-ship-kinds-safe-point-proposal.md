# DOWNSTREAM NOTICE id:20261111-072306-ship-kinds-safe-point-proposal
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-11T07:23:06+09:00
severity: info
checkpoint: ship-kinds-safe-point-proposal
change: /ship picks its kind by session state (more work follows → --quick, last ship → plain, asked → --safe); --quick works anywhere and marks commits `Ship: quick`; a plain ship also checks the unchecked quick files and proposes a safe point by score; new pnpm workflow notices safePoint status / quickFiles
why: the ship flow every repo uses changes; CLAUDE.md ship line now points to the skill for the kinds
required_actions: none
verify: pnpm test scripts/workflow/notices && pnpm workflow notices safePoint status && pnpm workflow notices safePoint quickFiles
manual_steps: -
refs: .claude/skills/ship/SKILL.md, scripts/workflow/notices/safePoint.mjs, .notices/README.md (セーフポイント), CLAUDE.md DOWNSTREAM_NOTICES ship
notes: score = commits since the last own safe tag (first-parent) / 80 + days / 3, propose at >= 1 or when no safe tag exists; override with --commits= / --days=
