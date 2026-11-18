---
paths:
  - "src/lib/globalLoader/**"
---
# lib/globalLoader
what: the closed lib of the full-screen loader: its state (a store inside), the show / hide hook and the render part | entry @/lib/globalLoader (GlobalScreenLoader, useGlobalLoader, LoaderOptions)
use: always
change: none → /order <direct parent>
rules:
using:
- gl_one_root: GlobalScreenLoader is placed once, in the root layout (src/app/layout.tsx) only
- gl_entry_only: the loader moves only through showLoader / hideLoader | the store is never exported or read from outside
- gl_old_paths: the old paths (@/stores/globalLoader, @/hooks/useGlobalLoader, Overlays/Loading/GlobalScreenLoader) are gone → import @/lib/globalLoader (lint deprecated-imports)
editing:
- gl_render_shelf: it draws the shelf ScreenLoader (mode "fullscreen") as is, kept equal by globalLoaderParity.test.tsx | its layer stays cover-layer, never a numeric raise
- gl_no_side_effects: package.json declares no `sideEffects` (the store is created at import)
read: show / hide, old paths → Usage | hook, options, types → API | render, layer → Internals | parity test → Verification
