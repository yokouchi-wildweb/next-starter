# DOWNSTREAM NOTICE id:20261104-085545-marketing-layout-switch
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-04T08:55:45+09:00
severity: info
checkpoint: marketing-layout-switch
change: src/app/(marketing)/layout.tsx becomes a 1-line frame switch (`export { MarketingLayout as default } from "./_layout/MarketingLayout";`) like (user) and admin; the default _layout/MarketingLayout.tsx is the same empty pass-through as before (no header, footer or slot). The layout is now an intake point (edit) and is checked by test:screens like the other frame switches.
why: A fork can now give its landing pages a common frame without editing upstream files: put _layout/MarketingLayout.replace.tsx beside the default and point layout.tsx at it. Rendering and behaviour are unchanged.
required_actions: none
verify: pnpm typecheck passes; pnpm test:screens passes
manual_steps: -
refs: src/app/(marketing)/layout.tsx, src/app/(marketing)/_layout/MarketingLayout.tsx, src/app/(marketing)/_layout/README.md, src/lib/screens/screens.test.mjs (FRAME_LAYOUTS), src/lib/forkOwnership/intake.txt, src/lib/screens/README.md, src/styles/README.md
notes: The (marketing)/layout.tsx of 88-base, TriQ, boardgame-site, next-vnx and oripa-do is identical to the old upstream file, so the merge takes the new 1-line switch without conflict. A fork that wraps its LPs in its own header / footer inside each page can move that common part to _layout/MarketingLayout.replace.tsx (named export MarketingLayout, no default export) and switch layout.tsx to "./_layout/MarketingLayout.replace" (steps: src/app/(marketing)/_layout/README.md).
