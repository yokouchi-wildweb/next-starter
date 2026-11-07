---
paths:
  - "src/**/*.tsx"
  - "src/styles/**"
  - "src/config/ui/**"
  - "src/lib/cn/**"
---
# STYLE_OWNERSHIP (upstream = structure, downstream = values)
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

ownership: see CORE_FILES (src/styles/core/** = upstream | src/styles/*.css at the root (entry global.css + palette / typography / overrides.css + generated gradient.css + fork-added), src/config/ui/*.config.ts = downstream) | color source of truth = CSS
config: variants / fonts / site theme are set through src/config/ui/*.config.ts define*Config({partial}) | variant and size names are public contract (rename → .notices) | before changing tokens, variants, fonts or theme → read src/styles/README.md
frame_dims: user / admin frame sizes (header, banner, bottom nav, safe area) → var(--app-*-height) / var(--app-safe-area-*), never hard-coded px (vars go 0 while a part is hidden) | a part portaled to body cannot inherit them → put useFrameDimsStyle() (@/hooks/useFrameDimsStyle) on its outer element, never read [data-frame-root] yourself | ref: src/app/(user)/_layout/README.md
layer_map: change a look at the widest layer that reaches it (token → config/ui variant override → frame → page → part name / spacing step → className) | lower layers use upper values, never restate them | ref: src/styles/README.md
fork_css_contract: fork CSS may target only [data-slot] marks and :root / .dark / [data-area] values | id, class names, data-component, DOM shape are not a contract (no notice on change)
building_a_part (MANDATORY):
- data-slot only where className cannot reach (frame parts, part internals) | name = kebab of the part (or sub-part) | removing / renaming a mark → .notices
- an element with both className and data-slot: data-slot (fork CSS, unlayered) always wins | add one only when all 3 hold: it takes className, a fork needs it site-wide, a variant override cannot serve it → add it to the both-list in src/styles/README.md
- appearance shadows = --appearance-shadow-<name> tokens in core/palette.default.css (:root / .dark), never literal shadow values in appearance.ts | no generic shadow scale beyond Tailwind --shadow-*
- never write explanations into fork-owned files (root src/styles/*.css, src/config/ui/*.config.ts after creation) → this file or src/styles/README.md
cn_class_groups (MANDATORY): a new `--text-*` token in theme.css → register it in src/lib/cn FLUID_TEXT_SIZES (test: pnpm test src/lib/cn/cn.test.mjs)
