# DOWNSTREAM NOTICE id:20261024-182504-statetabs-active-label-popover-collision
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-24T18:25:04+09:00
severity: info
checkpoint: statetabs-active-label-popover-collision
change: (1) StateTabs in uncontrolled mode (defaultValue, no value) kept `activeLabelClassName` on the initial tab forever (it compared against defaultValue), so after switching, the first tab's label stayed in the active color (by default white text on the inactive muted background). StateTabs now holds the current value internally in uncontrolled mode and passes it to Radix; onValueChange is still called; controlled mode is unchanged. (2) Overlays PopoverContent defaults `collisionPadding` to 8 (Radix default 0), so popovers near the viewport edge keep an 8px margin instead of touching or clipping at the edge. Pass `collisionPadding` to override.
why: Forks use both components; local fixes (a patched StateTabs, per-call collisionPadding) are no longer needed.
required_actions:
1. Merge upstream up to this checkpoint. If the fork patched src/components/Navigation/StateTabs/StateTabs.tsx or src/components/Overlays/Popover/PopoverPrimitives.tsx for these issues (find: `git diff upstream/main -- src/components/Navigation/StateTabs src/components/Overlays/Popover/PopoverPrimitives.tsx`), take upstream on conflict.
2. Fork call sites that pass `collisionPadding={8}` only to work around this (find: `grep -rn "collisionPadding" src`) may drop it. Optional.
verify: `pnpm typecheck` | an uncontrolled StateTabs: the active label color follows the selected tab | on a narrow viewport, a popover opened near the edge keeps a small gap from the screen edge
manual_steps: -
refs: src/components/Navigation/StateTabs/StateTabs.tsx | src/components/Overlays/Popover/PopoverPrimitives.tsx | order 20261019-122328-fork-extension-points-bundle item (16)
notes: No DB change, no db:push. | Popovers away from the edges look the same; only edge positioning changes.
