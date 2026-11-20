# DOWNSTREAM NOTICE id:20261120-161302-flux-lineage-touch-tip
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-20T16:13:02+09:00
severity: info
checkpoint: flux-lineage-touch-tip
change: /flux step 5a runs the upstream tip's .claude/skills/flux/lineage-touch.mjs from .flux/ with --upstream=<upstream>/<branch>; it reads the judging lib (src/lib/forkOwnership/lineage.mjs, forkIds.mjs) at that ref, so a fork whose tree lacks lineage.mjs no longer stops with ERR_MODULE_NOT_FOUND
why: lineage-touch.mjs imported the lib relatively from the fork's tree; an old fork without lineage.mjs could not run the override-contact check even from the tip's version
required_actions: none
verify: -
manual_steps: -
refs: .claude/skills/flux/lineage-touch.mjs, .claude/skills/flux/SKILL.md (step 5a), .claude/skills/flux/lineage-touch.test.mjs
notes: no fork action: /flux reads lineage-touch.mjs and SKILL.md at the upstream's tip
