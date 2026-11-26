# DOWNSTREAM NOTICE id:20261126-135711-lib-package-rules
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:4d5630e6b
date: 2026-11-26T13:57:11+09:00
severity: info
checkpoint: lib-package-rules
change: `pnpm check lib-package -- jsdoc --apply` writes only into your own libs (src/lib/CATALOG.md, your section): without `--lib` an ancestor's lib is skipped, naming one with `--lib` writes nothing and exits 2. The migration tools past their removal point (D101 (6): every Tier1 lib is closed) are removed: `pnpm check lib-package -- codemod`, `pnpm check lib-package -- moved`, and the marker file src/lib/drizzle/transaction.ts (read `@/lib/drizzle`)
why: core/lib.md: never edit an ancestor lib's internals; the codemod's header named its own removal point, which has come
required_actions:
1. Only a fork with its own libs not closed yet (`for d in src/lib/*/; do [ -f "$d/package.json" ] || echo "$d"; done`, keeping the names in your own section of src/lib/CATALOG.md; today 88-base: musicTheory, noteInput, pianoKeyboard, staffNotation, trainingSession): close each with `pnpm check lib-package -- declare <name> --apply`, then rewrite every import `pnpm lint` (import rule entry/only-entries) names to the entry it suggests, by hand (src/lib/README.md steps 7 and 9). Other forks: nothing to do
verify: `pnpm check lib-package` passes with no `undeclared` row
manual_steps: -
refs: scripts/structure/lib-package/jsdoc.mjs, scripts/structure/lib-package/declare.mjs, scripts/structure/lib-package/README.md, src/lib/README.md (steps 7, 9), .claude/rules/core/lib.md (closed_lib_package)
notes: Deleted with no destination: scripts/structure/lib-package/codemod.mjs, moved.mjs, renames.mjs, renames.json, codemod.test.mjs, moved.test.mjs, src/lib/drizzle/transaction.ts (no reader in the six forks). An earlier notice's codemod step (`pnpm check lib-package -- codemod --apply --base <sha>`) still runs on that segment's tree, before this segment. Fork-specific impact beyond the six: not checked.
