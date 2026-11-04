# DOWNSTREAM NOTICE id:20261105-081445-pick-ignores-shipped-index
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-05T08:14:45+09:00
severity: info
checkpoint: pick-ignores-shipped-index
change: the shipped index (.notices/shipped/) is outside pick: pnpm notices:pick-check and notices:hotfix-check lay a fix / hotfix commit on the base with its index change dropped (new scripts/notices/pickDroppingIndex.mjs), so a commit whose only conflict is the index line gets pick:clean / no conflict; /flux (hotfix step 1 and pick:clean fixes) continues when the cherry-pick conflicts only in .notices/shipped/ by keeping the fork's side (git rm when the fork has no such file) and `git cherry-pick --continue --no-edit`
why: /ship puts the notice's index line in the same commit as the body, and the append-only index conflicts on every base without it or with a shorter copy, so since the index was introduced every fix / hotfix was judged pick:- and /flux stopped at the cherry-pick (seen on 20261105-075841-frame-dims-portal-hook, commit 44097cff)
required_actions: none
verify: `pnpm test:notices` passes
manual_steps: -
refs: scripts/notices/pickDroppingIndex.mjs, scripts/notices/pickCheck.mjs, scripts/notices/hotfixCheck.mjs, .notices/README.md「先に取れる印(pick)」「緊急修正(hotfix)」, .claude/skills/flux/SKILL.md, .claude/skills/ship/SKILL.md
notes: a fork's /flux reads its own copy of the skill, so the new rule applies to picks after the fork has merged this version. Until then (e.g. hotfix 20261105-075841-frame-dims-portal-hook, index row pick:-), resolve an index-only conflict by hand the same way: keep the fork's .notices/shipped/<name>.md (or git rm it when the fork has none) and continue
