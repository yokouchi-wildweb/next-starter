---
paths:
  - "src/components/Layout/**"
---
# components/Layout
what: layout wrappers (Block, InBlock, Flex, Stack, Grid, Section, Main, FullScreen, ScaledStage, Hidden) with shared appearance and spacing props, entry @/components/Layout
use: always
change: placement → spacing = `--space-*` values in `:root` of any root src/styles/*.css (the tokens live in src/styles/core/config.css) | appearance shadows = `--appearance-shadow-<name>` in src/styles/palette.css | Main parts = their `data-slot` in fork CSS
rules:
using:
- layout_pick: plain wrapper → Block | vertical spacing between children → Stack `gap` | alignment or a row → Flex
- layout_ref: a library that needs the rendered element gets `ref` on Block / InBlock / Flex / Stack / Grid / Section / Main / Hidden, never a raw div
- spacing_scale: spacing props take a scale name or a per-breakpoint object | a size not on the scale → a numeric class in `className`
- spacing_no_build: never build spacing classes from strings (`gap-${n}`): Tailwind emits literal classes only
- inner_padding: a part's own inner padding changes with its size variant, never with the spacing scale
- section_as: Section `as` follows the HTML meaning (article, aside, nav, header, footer, else section), never a raw tag
- fullscreen_layer: FullScreen `layer` takes page layers only | something that must show above a modal → a floating part (Overlays), never FullScreen
editing:
- spacing_table: spacing classes are looked up in spacingClasses.generated.ts (pnpm generate styles from spacingScale.ts), never hand-edited
- spacing_relay: a part that relays a spacing prop types it SpacingValue (e.g. AppForm `fieldSpace`)
- fullscreen_no_measure: FullScreen reads `var(--viewport-height, 100dvh)` only, never measures | the general rule = core/style.md viewport_no_measure
read: pick a part → Overview | Block / Flex / Stack → Usage | props, spacing scale, Main / Section / FullScreen / ScaledStage options → API | fork look, data-slot → Extension | tokens → Extension | spacing class table, height source → Internals
