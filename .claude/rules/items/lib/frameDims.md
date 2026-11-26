---
paths:
  - "src/lib/frameDims/**"
  - "src/config/lib/frameDims.config.ts"
---
# lib/frameDims
what: useFrameDimsStyle() (@/lib/frameDims) gives a body-portaled part the frame's size variables (header, banner, bottom nav heights) with the current values of the frame root a frame registered with useFrameRootRef()
use: always
change: counterpart = src/config/lib/frameDims.config.ts (vars)
rules:
using:
- portal_root_style: put the returned style on the portaled part's outermost element and use var() inside | never read the frame yourself
- no_safe_area_copy: safe-area variables stay on :root, never copied
- frame_registers: a frame (UserLayout, AdminLayout, a fork's own frame) puts `ref={useFrameRootRef()}` on its outer element next to data-frame-root | only registered roots are measured (the last registered one still in the document), never the document's first [data-frame-root]
editing:
- names_follow_css: vars names follow src/styles/core/frame.css, part names follow the frame parts list (src/app/_layout/frame/parts.mjs data-slot)
read: what it is → Overview | example → Usage | values, SSR → API | config → Extension | tracking → Internals
