---
paths:
  - "src/components/Layout/**"
---
# components/Layout
what: layout wrappers (Block, InBlock, Flex, Stack, Grid, Section, Main, FullScreen, ScaledStage) and the kiosk page frame KioskFrame, with shared appearance (appearance.ts) and spacing props (@/lib/spacing); each part is a unit read as @/components/Layout/\<Part\>
use: always
change: counterpart → spacing = `--space-*` values in `:root` of any root src/styles/*.css (the tokens live in src/styles/core/config.css) | appearance shadows = `--appearance-shadow-<name>` in src/styles/palette.css | Main parts = their `data-slot` in fork CSS
rules:
using:
- layout_pick: plain wrapper → Block | vertical spacing between children → Stack `gap` | alignment or a row → Flex
- layout_ref: a library that needs the rendered element gets `ref` on Block / InBlock / Flex / Stack / Grid / Section / Main, never a raw div
- spacing_scale: spacing props take a scale name or a per-breakpoint object | a size not on the scale → a numeric class in `className`
- spacing_no_build: never build spacing classes from strings (`gap-${n}`): Tailwind emits literal classes only
- inner_padding: a part's own inner padding changes with its size variant, never with the spacing scale
- section_as: Section `as` follows the HTML meaning (article, aside, nav, header, footer, else section), never a raw tag
- fullscreen_layer: FullScreen `layer` takes page layers only | something that must show above a modal → a floating part (Overlays), never FullScreen
- kiosk_scope: KioskFrame = the viewport-fixed root of standalone routes with no layout | a non-scrolling page inside the user or admin layout = `page: { fill: true }` in the frame.ts beside the page (frame.override.ts in a lower repo), never KioskFrame
- kiosk_child_height: a child of KioskFrame gets the remaining height by `flex-1 min-h-0` only | never `calc(100dvh - N)` or magic numbers | rows split by `flex-1 min-h-0` / `shrink-0`, never fixed `h-[Npx]` rows summing past the viewport
- kiosk_scroll: the frame never scrolls | a scrolling area = a child pane with `overflow-y-auto`
- kiosk_fluid_text: text on a fluid kiosk screen = `text-fluid-*` (or TextBlocks fluid sizes), not fixed sizes like `text-5xl`
- kiosk_stage_choice: input-heavy screens (forms, scroll panes) → fluid layout, not ScaledStage | own fixed / portal overlays stay outside it (Overlays/ parts are fine: BodyPortal)
- fit_scale_ref: the container measured by useFitScale takes its `ref` on a Layout wrapper (layout_ref), never a raw div | ScaledStage measures its own container
editing:
- spacing_relay: a part that relays a spacing prop types it SpacingValue from @/lib/spacing (e.g. AppForm `fieldSpace`)
- fullscreen_no_measure: FullScreen reads `var(--viewport-height, 100dvh)` only, never measures | the general rule = core/style.md viewport_no_measure
- kiosk_no_measure: KioskFrame never measures its height | the one source = `--viewport-height`, written only by ViewportHeightWatcher (@/lib/viewport) | the general rule = core/style.md viewport_no_measure
- kiosk_no_button: no fullscreen button inside KioskFrame (the page places one with useFullscreen)
read: pick a part → Overview | Block / Flex / Stack, build a kiosk page → Usage | props, spacing scale, Main / Section / FullScreen / ScaledStage / KioskFrame options → API | fork look, data-slot → Extension | tokens → Extension | spacing class table, height source, kiosk height, transform mechanism → Internals
