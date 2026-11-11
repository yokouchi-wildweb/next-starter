# DOWNSTREAM NOTICE id:20261111-191238-same-basename-ts-tsx
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-11T19:12:38+09:00
severity: info
checkpoint: same-basename-ts-tsx
moved: src/features/core/purchaseRequest/hooks/usePurchaseStatusPolling.test.tsx -> src/features/core/purchaseRequest/hooks/usePurchaseStatusPolling.render.test.tsx; src/features/core/wallet/hooks/usePurchaseBonuses.test.tsx -> src/features/core/wallet/hooks/usePurchaseBonuses.render.test.tsx
change: pnpm check rules (gate ship) now also fails when one folder under src/, scripts/ or eslint-rules/ holds <base>.ts and <base>.tsx (scripts/workflow/rules/sameBasename.mjs + sameBasename.test.mjs; tsc reads only the .ts of such a pair and silently skips the .tsx, so its type errors never fail typecheck). Its gate watch now includes src/**, scripts/**, eslint-rules/**. Upstream's two pairs were split by renaming the render tests to <name>.render.test.tsx (what they test is unchanged; tsc now reads them, no new type errors).
why: a type error in the skipped .tsx never failed pnpm typecheck; now nothing hides it
required_actions: none
verify: -
manual_steps: -
refs: scripts/workflow/rules/sameBasename.mjs, scripts/workflow/rules/check.mjs, CLAUDE.md CORE_RULES test line, order 20261111-191009-same-basename-ts-tsx
notes: If pnpm check rules stops on a pair in your own files, rename one of the two (e.g. <name>.render.test.tsx for a render test) and run pnpm typecheck: errors that appear were hidden before. Forks (read-only git ls-files in 88-base, TriQ, boardgame-site, next-vnx, oripa-do): no fork-owned pairs; boardgame-site holds the two upstream pairs, which the merge renames.
