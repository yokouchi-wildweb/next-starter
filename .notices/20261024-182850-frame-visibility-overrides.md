# DOWNSTREAM NOTICE id:20261024-182850-frame-visibility-overrides
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-24T18:28:50+09:00
severity: info
checkpoint: frame-visibility-overrides
change: The four user-frame visibility contexts (src/components/AppFrames/User/contexts/{Header,HeaderNav,Footer,BottomNav}VisibilityContext.tsx) are now built by the new contexts/createVisibilityContext.tsx. State = a base value + per-caller overrides; `visibility` = base with the overrides applied in registration order (later wins). New on every use*Visibility(): `setOverride(id, partial)` / `clearOverride(id)`. HideHeader / HideHeaderNav / HideFooter / HideBottomNav register an override under their own useId() and on unmount clear only that override (they used to call reset(), which wiped everything). Existing exports, types, defaults and `setVisibility` / `reset` are kept; `setVisibility` / `reset` now act on the base value only, so `reset()` no longer removes Hide* overrides.
why: Navigating between two pages that both use a Hide* component (with the PageTransition exit animation, or two Hide* on one page) let the leaving page's reset() run after the new page had hidden the frame, so the header / footer / bottom nav reappeared on the new page.
required_actions:
1. Merge upstream up to this checkpoint. If the fork patched these contexts or controls for this race (find: `git diff upstream/main -- src/components/AppFrames/User/contexts src/components/AppFrames/User/controls`), take upstream on conflict.
2. Fork components that hide a frame part themselves with `setVisibility(...)` on mount and `reset()` on unmount (find: `grep -rn "useHeaderVisibility\|useHeaderNavVisibility\|useFooterVisibility\|useBottomNavVisibility" src | grep -v AppFrames/User/contexts`) keep working as before but still have the race; switch them to `const id = useId(); setOverride(id, {...})` on mount and `clearOverride(id)` on unmount (see controls/HeaderControl.tsx).
verify: `pnpm typecheck` | moving between two pages that both use `<HideHeader />` (with PageTransition) never shows the header | moving to a page without Hide* restores the default
manual_steps: -
refs: src/components/AppFrames/User/contexts/createVisibilityContext.tsx | src/components/AppFrames/User/controls/*.tsx | src/components/AppFrames/User/README.md (HideHeader 動作仕様) | order 20261019-122328-fork-extension-points-bundle item (18)
notes: No DB change, no db:push. | These contexts are scheduled to move with the remaining AppFrames/User parts in a later frame-move segment; that move will be announced with moved: as usual.
