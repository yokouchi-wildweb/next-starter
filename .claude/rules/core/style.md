---
paths:
  - "src/**/*.tsx"
  - "src/styles/**"
  - "src/config/lib/variantOverrides.config.ts"
  - "src/config/lib/fonts.ui.config.ts"
  - "src/config/lib/siteTheme.config.ts"
  - "src/lib/cn/**"
---
# style
> **ROLE**: loaded when writing any .tsx or styles | holds the style rules (CLAUDE.md COMPONENTS style)
> Tier1-owned: forks never edit (gap → /order next-starter)

ownership: see CORE_FILES (src/styles/core/** = upstream | src/styles/*.css at the root (entry global.css + palette / typography / overrides.css + generated gradient.css + fork-added) = downstream) | color source of truth = CSS
config: variants / fonts / site theme are set through the overrides src/config/lib/variantOverrides.config.ts / fonts.ui.config.ts / siteTheme.config.ts define*Config({partial}) | variant and size names are public contract (rename → .notices) | before changing tokens, variants, fonts or theme → read src/styles/README.md
semantic_colors: success|info|warning|destructive → `bg-x` / `border-x` = fill | `text-x-foreground` = text on the fill | `text-x-text` = text on a plain background | NEVER `text-x` (lint style-tokens/no-bare-semantic-text) | scrim `bg-overlay/NN` | no raw white / black (background / foreground / card tokens) | lint style-tokens/no-raw-palette (exception = reasoned eslint-disable, both rules)
frame_dims: user / admin frame sizes (header, banner, bottom nav, safe area) → var(--app-*-height) / var(--app-safe-area-*), never hard-coded px (vars go 0 while a part is hidden) | a part portaled to body cannot inherit them → put useFrameDimsStyle() (@/hooks/useFrameDimsStyle) on its outer element, never read [data-frame-root] yourself | ref: src/app/(user)/_layout/README.md
- viewport_no_measure: never measure the viewport | read --viewport-height (written only by ViewportHeightWatcher, @/lib/viewport)
layer_map: change a look at the widest layer that reaches it (token → variantOverrides override → frame → page → part name / spacing step → className) | lower layers use upper values, never restate them | ref: src/styles/README.md
stacking: order against the page = a @/lib/zLayer name (zLayerClass, var(--z-layer-<name>)), never a z-index number | a layer of your own (for your own page elements only) → src/config/lib/zLayer.config.ts (`above:` a page layer, background … forefront, or a layer you added; never above floating) + pnpm generate styles | never redefine an upstream --z-layer-* value
- floating pieces (dialog, modal, sheet, popover, tooltip, menu, select list) portal to body and share the one `floating` layer: the one opened later is on top | they take no layer prop: never lift one with a number or another name | above them only `toast`, then `cover` (blocks presses) | a press inside those two is not an outside press (isAboveFloatingTarget)
- order inside one part = `isolate` on its root, then small z-* freely (it cannot leak out) | a name orders things only up to the nearest stacking context (an ancestor with transform, filter, opacity below 1, isolate, or position + z-index) → a piece that must escape goes through a portal | which name for what → src/lib/zLayer/README.md
fork_css_contract: fork CSS may target only [data-slot] marks and :root / .dark / [data-area] values | id, class names, data-component, DOM shape are not a contract (no notice on change)
building_a_part (MANDATORY):
- data-slot only where className cannot reach (frame parts, part internals) | name = kebab of the part (or sub-part) | removing / renaming a mark → .notices
- an element with both className and data-slot: data-slot (fork CSS, unlayered) always wins | add one only when all 3 hold: it takes className, a fork needs it site-wide, a variant override cannot serve it → add it to the both-list in src/styles/README.md
- appearance shadows = --appearance-shadow-<name> tokens in core/palette.css (:root / .dark), never literal shadow values in appearance.ts | no generic shadow scale beyond Tailwind --shadow-*
- never write explanations into fork-owned files (root src/styles/*.css after creation) → this file or src/styles/README.md
cn_class_groups (MANDATORY): a new `--text-*` token in theme.css → register it in src/lib/cn FLUID_TEXT_SIZES (guarded by src/lib/cn/cn.test.mjs, /ship runs it)
