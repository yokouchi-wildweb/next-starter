---
paths:
  - "src/components/AppFrames/**"
---
# components/AppFrames
what: shared frame parts with no permanent home yet: the kiosk page frame KioskFrame (@/components/AppFrames/Kiosk) and the admin list parts Admin/Elements | User/ holds no parts (moved to src/app/(user)/_layout/)
use: always
change: none → /order <direct parent>
rules:
using:
- kiosk_scope: KioskFrame = the viewport-fixed root of standalone routes with no layout | a non-scrolling page inside the user or admin layout = `page: { fill: true }` in the frame.ts beside the page (frame.override.ts in a lower repo), never KioskFrame
- kiosk_child_height: a child of KioskFrame gets the remaining height by `flex-1 min-h-0` only | never `calc(100dvh - N)` or magic numbers | rows split by `flex-1 min-h-0` / `shrink-0`, never fixed `h-[Npx]` rows summing past the viewport
- kiosk_scroll: the frame never scrolls | a scrolling area = a child pane with `overflow-y-auto`
- kiosk_fluid_text: text on a fluid kiosk screen = `text-fluid-*` (or TextBlocks fluid sizes), not fixed sizes like `text-5xl`
- kiosk_stage_choice: input-heavy screens (forms, scroll panes) → fluid layout, not ScaledStage | own fixed / portal overlays stay outside it (Overlays/ parts are fine: BodyPortal)
- fit_scale_ref: the container measured by useFitScale is a raw div (Layout wrappers do not forward ref)
editing:
- frame_parts_place: new layout frame parts go to src/app/<route>/_layout/, never here
- kiosk_no_measure: KioskFrame never measures its height | the one source = `--viewport-height`, written only by ViewportHeightWatcher (@/lib/viewport)
- kiosk_no_button: no fullscreen button inside KioskFrame (the page places one with useFullscreen)
read: build a kiosk page → src/components/AppFrames/Kiosk/README.md Usage | props, fit options → src/components/AppFrames/Kiosk/README.md API | height, transform mechanism → src/components/AppFrames/Kiosk/README.md Internals | old Hide* parts → src/components/AppFrames/User/README.md Usage
