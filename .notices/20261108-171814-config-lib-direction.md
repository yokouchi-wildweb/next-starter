# DOWNSTREAM NOTICE id:20261108-171814-config-lib-direction
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-08T17:18:14+09:00
severity: info
checkpoint: config-lib-direction
change: the dotted-name classifier (classifyDottedName, oldMarkerProblem, MARKER_MIGRATION_NOTICE) moved from src/lib/forkOwnership/dottedNames.mjs to src/lib/districtMap/dottedNames.mjs, so lib imports between the two libs run one way only (forkOwnership -> districtMap; test src/lib/districtMap/direction.test.mjs)
why: forks that never import these lib files have nothing to do; a fork tool that imports the old paths keeps working now but should switch before the old entries are removed
required_actions:
1. Optional, only if fork code or scripts import the old paths: `git grep -n -E "forkOwnership/(dottedNames|declarations)" -- ':!.notices'` and point each import at src/lib/districtMap/dottedNames.mjs or src/lib/districtMap/declarations.mjs (same exports)
verify: pnpm typecheck; pnpm test src/lib/districtMap src/lib/forkOwnership
manual_steps: -
refs: src/lib/districtMap/README.md | src/lib/districtMap/direction.test.mjs | config council legate l1 sheet 03 order 21
notes: No moved: line because the old path stays as a re-export (shipped codemods import it; forks never edit inside an ancestor's lib, nothing to port). Old entries src/lib/forkOwnership/dottedNames.mjs and src/lib/forkOwnership/declarations.mjs are re-exports only and will be removed in a later notice. Generated files and pnpm workflow ownership check output are unchanged.
