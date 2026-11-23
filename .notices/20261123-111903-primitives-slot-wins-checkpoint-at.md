# DOWNSTREAM NOTICE id:20261123-111903-primitives-slot-wins-checkpoint-at
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261123-111526-notice-body-index-same-commit | commit:- (this commit)
date: 2026-11-23T11:19:03+09:00
severity: info
checkpoint: primitives-slot-wins-checkpoint-at
resolves: 20261119-111918-notice-body-index-same-commit
change: the shipped body of 20261111-122421-primitives-slot-wins now carries `checkpoint_at: a8e5dd124…` (the commit right after its add, which added its row to the old index .notices/shipped/), so /flux cuts that segment after the row and the segment's `pnpm check notices` no longer stops on "本文があるのに索引に行が無い"; the checkpoint_at: rule (core/notices.md checkpoint: - point:, .notices/README.md) now says "segment (the body, or the row of the old index) completed later"
why: a lagging fork taking checkpoint primitives-slot-wins alone ran the old index check on a tree where the body existed without its row; the prevention itself came with notice-history (D350: no index, the list is the history of .notices/, nothing to keep in step)
required_actions: none
verify: a fork behind 85cdcf448: `node .claude/skills/flux/incoming.mjs --upstream=<upstream>/<branch>` lists 20261111-122421-primitives-slot-wins with point a8e5dd124… and no checkpoint_at warning for it
manual_steps: -
refs: .notices/20261111-122421-primitives-slot-wins.md, .notices/20261120-122554-notice-history.md, .claude/skills/flux/incoming.mjs (checkpoint_at), upstream 85cdcf448 / a8e5dd124
notes: a fork already past primitives-slot-wins has nothing to do. A history scan of every next-starter notice added while the row check existed (a6ec3794a..f1a54d875) found no other body whose segment point lacked its row, except the four D8 side-commit picks of 2026-11-05 (presenterfor-readonly-pick, setting-test-fork-sections-pick, feature-map-intake-pick, fieldtype-registry-display-pick), which are side commits taken by pick or at their merge (the row check passes picked ids since 0b9a6784e); they were left as they are.
