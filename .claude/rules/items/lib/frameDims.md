---
paths:
  - "src/lib/frameDims/**"
  - "src/config/lib/frameDims.config.ts"
---
# lib/frameDims
what: useFrameDimsStyle() (@/lib/frameDims) gives a body-portaled part the frame's size variables (header, banner, bottom nav heights) with the frame's current values
use: always
change: counterpart = src/config/lib/frameDims.config.ts (rootSelector, vars)
rules:
using:
- portal_root_style: put the returned style on the portaled part's outermost element and use var() inside | never read the frame yourself
- no_safe_area_copy: safe-area variables stay on :root, never copied
editing:
- names_follow_css: vars names follow src/styles/core/frame.css, part names follow the frame parts list (src/app/_layout/frame/parts.mjs data-slot)
read: what it is → Overview | example → Usage | values, SSR → API | config → Extension | tracking → Internals
