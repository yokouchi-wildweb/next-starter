---
paths:
  - "src/lib/viewport/**"
---
# lib/viewport
what: the closed lib that reads the viewport's real size and orientation: the size store, its single writer ViewportHeightWatcher and the read hooks | entry @/lib/viewport (useViewportSize, useViewportOrientation, useMediaQuery)
use: always
change: none → /order <direct parent>
rules:
using:
- vp_one_writer: ViewportHeightWatcher is the only writer of the size and `--viewport-height`, rendered once by the root layout and nowhere else
- vp_no_measure: other parts never measure the viewport or set the CSS variable | a part needing the height reads `var(--viewport-height, 100dvh)` in CSS
editing:
- vp_no_set_export: the store's setSize is never exported from the entry
- vp_short_height_pair: SHORT_HEIGHT_MAX_PX moves together with the `short:` variant in src/styles/core/theme.css (Tailwind media queries cannot read a CSS variable)
- vp_no_side_effects: package.json declares no `sideEffects` (the store is created at import)
read: height in CSS, hooks, old paths → Usage | hooks and types → API | writer, short height, package.json → Internals
