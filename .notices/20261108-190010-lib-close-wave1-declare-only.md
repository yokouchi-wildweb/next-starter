# DOWNSTREAM NOTICE id:20261108-190010-lib-close-wave1-declare-only
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-08T19:00:10+09:00
severity: action-required
checkpoint: lib-close-wave1-declare-only
change: src/lib/appEnv, src/lib/cn and src/lib/csv are now closed libs (package.json with exports "." only, libs [], no sideEffects; standalone tsconfig.json) | src/lib/zod (getZodDefaults) is deleted with its src/lib/CATALOG.md line
why: lint import-boundaries/lib-entry now applies to these three libs: a fork file that reads a file inside them (e.g. @/lib/cn/index, @/lib/appEnv/appEnv, @/lib/csv/downloadCsv) instead of the entry fails pnpm lint; a fork file that imports @/lib/zod fails typecheck
required_actions:
1. Merge upstream up to this checkpoint. Conflicts in src/lib/appEnv, src/lib/cn, src/lib/csv, src/lib/CATALOG.md (upstream section) and src/registry/district-map.jsonl: take upstream (district-map: then run `pnpm generate district-map`).
2. Rewrite imports to the entries: `pnpm check lib-package -- codemod` (dry-run), then `pnpm check lib-package -- codemod --apply`. Fix each stop it lists as the codemod's output says (named imports from `@/lib/<name>`; a name not on the entry → reasoned `// eslint-disable-next-line import-boundaries/lib-entry -- <why>, /order next-starter <id>` + `/order next-starter` asking for it).
3. If `git grep -n "@/lib/zod" -- src scripts` finds anything (upstream counted 0 callers in all 5 forks): copy what you use of getZodDefaults into a lib of your own (your CATALOG section) and import it from there.
4. `pnpm typecheck` → `pnpm lint` → `pnpm check lib-package` → `pnpm build`.
verify: `pnpm check lib-package -- codemod` reports 0 statements (stops only where you kept a reasoned eslint-disable); `pnpm check lib-package -- --list` shows appEnv, cn, csv as closed; `git grep -n "@/lib/zod" -- src scripts` finds nothing; `pnpm typecheck`; `pnpm lint`; `pnpm build`
manual_steps: -
refs: src/lib/README.md 「lib を閉じる手順」, scripts/structure/lib-package/README.md, .notices/20261108-172627-shared-shelf-lib-close-base.md, order 20261108-184001-lib-close-declare-only (council 20261030-212344, shelf legate L1.32)
notes: lib-close wave 1, quest 1/5. moved: none (no file moved). imports: rows (old specifier -> entry) for this segment: @/lib/cn/index -> @/lib/cn. Removed: src/lib/zod (getZodDefaults; 0 callers upstream and in the 5 forks). Every public name of appEnv, cn and csv is kept. pathPattern is held back: it is an .mjs-only lib (no .ts), the standalone tsconfig does not fit it; how .mjs-only libs (pathPattern, districtMap, folderCatalog, forkOwnership, libPackage) are closed is decided in the shelf plan sheet.
