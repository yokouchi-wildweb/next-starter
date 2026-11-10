# DOWNSTREAM NOTICE id:20261110-143000-frames-move-merge-head
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-10T14:30:00+09:00
severity: info
checkpoint: frames-move-merge-head
fixes: 20261109-175947-shared-shelf-frame-override
resolves: 20261110-140016-frame-override-rename-conflict-frames-move
change: pnpm check extensions -- frames-move counts upstream's tree from the parent remote's branch (the fetched <remote>/<branch>) and the merge-base with it, besides the ledger base. The merge in progress (MERGE_HEAD) counts only when it is an ancestor of that branch (an upstream version being merged); a merge of the fork's own commit (a railroad track branch, a feature branch) no longer counts as upstream, so the fork's own routes in that commit are not taken for parent routes. forkAddedFiles (src/lib/forkOwnership/check.mjs) also returns parentRef.
why: oripa-do merged a track commit carrying its own routes while running frames-move: MERGE_HEAD's tree made its 21 own frame.ts look like declarations beside parent routes, and the tool proposed moving them to frame.override.ts (a wrong resolution). The same merge hit a conflict the shared-shelf-frame-override step 1 does not describe (below).
required_actions:
1. Merge upstream up to this checkpoint (tool and README text only; no fork file changes).
2. Addition to notice 20261109-175947-shared-shelf-frame-override step 1, for a fork that still has to apply it: when the merge's common ancestor already holds the fork's src/app/(user)/frame.ts (parallel branches, e.g. railroad tracks: one moved it to frame.override.ts, the other merged upstream's rename), git pairs upstream's renamed frame.ts with the fork's frame.override.ts and the conflict lands on src/app/(user)/frame.override.ts. Resolve it as: frame.override.ts = the fork's content (`export const override`, the fork's values), src/app/(user)/frame.ts = upstream's file (`git checkout --theirs` or the upstream version, `export const frame`). Then continue with that notice's step 2.
verify: `pnpm check extensions -- frames-move` during a merge of a fork commit prints no MERGE_HEAD among the upstream trees and lists none of the fork's own frame.ts | pnpm check extensions
manual_steps: -
refs: scripts/structure/extensions/framesMove.mjs (upstreamFiles), scripts/structure/extensions/framesMove.test.mjs, src/app/_layout/frame/README.md, notice 20261109-175947-shared-shelf-frame-override, oripa-do commit 8b6df2f8c (J83)
notes: A plain /flux merge of upstream never hits step 2's conflict (its common ancestor is an upstream version without the fork's frame.ts); only merges between fork branches that split before the frame-override segments do. oripa-do resolved J83 by hand as written above.
