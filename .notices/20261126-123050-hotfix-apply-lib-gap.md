# DOWNSTREAM NOTICE id:20261126-123050-hotfix-apply-lib-gap
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261126-122721-hotfix-apply-missing-lib-gap | commit:(this commit)
date: 2026-11-26T12:30:50+09:00
severity: info
checkpoint: hotfix-apply-lib-gap
resolves: 20261126-122654-hotfix-apply-missing-lib-gap
change: hotfixApply (scripts/workflow/notices/hotfixApply.mjs, read from the upstream tip by /flux) reports a new gap kind `libs`: a lib the applied / added files rely on (an `@/lib/<name>` import of a code file, the `libs` of a lib's package.json) that the fork's tree lacks → `gap libs <file> -> @/lib/<name>(lib が fork に無い)` / `gap libs <lib>/package.json: libs の <name> が fork に無い`; the other gap kinds and the replaced / merged / added / left-out lines are unchanged
why: info only; /flux runs the tool from the upstream tip, so the next hotfix pick already prints these lines (write them in the report and the ledger notes like the other gap lines; never a stop)
required_actions: none
verify: pnpm test scripts/workflow/notices
manual_steps: -
refs: scripts/workflow/notices/lib.hotfixGaps.mjs (libGaps), scripts/workflow/notices/hotfixApply.mjs, .claude/skills/flux/SKILL.md (gap lines), .notices/README.md (緊急修正), order 20261126-122721-hotfix-apply-missing-lib-gap
notes: case: hotfix 135b6ab24 (Dialog.tsx / useSeamlessReel.ts read @/lib/pageLeave, brought by the earlier hotfix activity-once-init) applied on a tree without pageLeave printed no gap
