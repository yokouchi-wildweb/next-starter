---
paths:
  - "src/components/Button/**"
---
# components/Button
what: the button parts Button, LinkButton, PseudoButton, RoundedButton, BookmarkTag, TabletButton, each a unit @/components/Button/\<Part\>, and the helper unit @/components/Button/variants (buttonVariants, tabletButtonVariants and their style types)
use: always
change: counterpart → shape (radius, shadow, border, sizes) = `button` / `tabletButton` keys of src/config/lib/variantOverrides.config.ts | heights = `--control-h-*` / `--tablet-control-h-*` values in `:root` of any root src/styles/*.css (the tokens live in src/styles/core/config.css)
rules:
using:
- button_source: a button comes from @/components/Button/\<Part\> | the style table only from @/components/Button/variants | Primitives/Button directly only when the finished buttons fall short
- button_loading: a running action shows `loading` (+ `loadingLabel`) on Button / TabletButton, never a hand-built Spinner inside the button or an extra term in `disabled`
- shaped_press: a press area shaped by className (card row, table cell) → Button variant="none" size="none" (+ iconSizing="none" when the caller sizes icons)
- file_pick: a button-shaped file picker → FilePickButton, never label + buttonVariants
- control_size: buttons in a row with inputs take the same `size`, no height overrides
editing:
- control_height: button heights = `--control-h-<size>` / `--tablet-control-h-<size>` tokens, never a numeric h-* (variants/controlHeight.test.ts)
- variant_names: variant / size names are a contract read by downstream config → removing or renaming one ships a notice
- loading_shared: a button that takes loading reuses resolveButtonLoading (Button.tsx), never its own Spinner branch
read: pick a part, variants helper → Overview | loading, shaped press area → Usage | props, loading, sizes → API | downstream shape, tokens → Extension | Primitives base, resolveButtonLoading, height test → Internals
