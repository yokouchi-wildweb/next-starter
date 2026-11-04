# DOWNSTREAM NOTICE id:20261105-075841-frame-dims-portal-hook
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-05T07:58:41+09:00
severity: info
checkpoint: frame-dims-portal-hook
fixes: 20261102-222255-frame-mobile-a11y
resolves: 20261105-073339-frame-dims-for-portaled-parts
hotfix: since frame-mobile-a11y the bottom nav is taller by the safe-area, so fork parts portaled to body that hard-code the nav px overlap the nav icons on iPhone in production; this gives them the frame's value
change: new public hook useFrameDimsStyle() (@/hooks/useFrameDimsStyle) returns a style object copying the computed --app-header-height / --app-banner-height / --app-bottom-nav-height of the outer frame [data-frame-root] (0 while a part is hidden by a page mark or device visibility; empty outside a frame and during SSR), live on mark / attribute / viewport changes; put it on the outer element of a part portaled to body and keep using var(--app-*-height) inside; GlobalToast now uses it (no longer stale while a toast is shown); also exported: FRAME_DIM_VARS, readFrameDimsStyle, types FrameDimPart / FrameDimsStyle
why: parts portaled to body (outside the frame root) resolve var(--app-bottom-nav-height) to :root's 0px and so hard-coded the nav px; after frame-mobile-a11y that px misses the safe-area (~34px on iPhone) and the part covers the nav
required_actions: none
verify: `pnpm typecheck` passes | `pnpm test:frame-dims` passes | optional (fork with a BodyPortal part above the bottom nav, e.g. oripa-do ResultActionBar): replace the hard-coded nav offset (find with `git grep -n "BodyPortal" -- src`, then classes like `bottom-16` / `bottom-[64px]` near it) with `style={useFrameDimsStyle()}` on the portaled outer element and `bottom-[var(--app-bottom-nav-height,0px)]`, then check on an iPhone-sized viewport that the part sits above the nav and at 0 where the nav is hidden
manual_steps: -
refs: src/hooks/useFrameDimsStyle.ts, src/lib/toast/components/GlobalToast.tsx, src/app/(user)/_layout/README.md「寸法の CSS 変数」, order 20261105-073339-frame-dims-for-portaled-parts
notes: additive only, no change for forks that do not use it. The hook reads only [data-frame-root] and the variable names, not Hide* or any mark names, so it keeps working when the frame's hide mechanism changes. The rule line (.claude/rules/core/style.md frame_dims: a part portaled to body uses useFrameDimsStyle(), never reads [data-frame-root] itself) ships in the next commit, kept out of this one so it picks cleanly onto frame-mobile-a11y
