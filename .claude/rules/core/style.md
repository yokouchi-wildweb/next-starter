---
paths:
  - "src/**/*.tsx"
  - "src/styles/**"
  - "src/config/ui/**"
  - "src/lib/cn/**"
---
# STYLE_OWNERSHIP (upstream = structure, downstream = values)
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /upreq) | FORMAT_RULE applies

ownership: see CORE_FILES (src/styles/custom/**, src/config/ui/*.config.ts = downstream) | color source of truth = CSS
config: variants / fonts / site theme are set through src/config/ui/*.config.ts define*Config({partial}) | variant and size names are public contract (rename → .notices) | before changing tokens, variants, fonts or theme → read src/styles/README.md
cn_class_groups (MANDATORY): a new `--text-*` token in theme.css → register it in src/lib/cn FLUID_TEXT_SIZES (test: pnpm test:cn)
