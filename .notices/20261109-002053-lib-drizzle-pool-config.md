# DOWNSTREAM NOTICE id:20261109-002053-lib-drizzle-pool-config
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-09T00:20:53+09:00
severity: action-required
checkpoint: lib-drizzle-pool-config
resolves: 20261101-111956-config-drizzle-pool
change: the DB pool options of src/lib/drizzle come from the lib config override src/config/lib/drizzle.config.ts (@lib-config/drizzle): keys max (default 3, as before), idleTimeout → postgres-js idle_timeout and connectTimeout → connect_timeout (seconds; default unset = postgres-js defaults, as before); values must be positive integers (ConfigValidationError at load) | prepare: false stays fixed | new type DrizzleOverride on @/lib/drizzle | upstream ships the empty override (`export default {} satisfies DrizzleOverride;`) | drizzle's package.json gains libs ["defineConfig"] (tsconfig.json paths follow)
why: the override file must exist or tsc / build fail (TS2307 @lib-config/drizzle); a fork that edited src/lib/drizzle/index.ts for its pool values (oripa-do, permit of order 20261101-111956) now has an intake and must move its values there, because this notice resolves that order and its temporary permit expires
required_actions:
1. Merge upstream up to this checkpoint. Conflicts in src/lib/drizzle/** (index.ts, package.json, tsconfig.json): take upstream (`git checkout --theirs` / upstream's version) and drop your own edit of src/lib/drizzle/index.ts.
2. Keep src/config/lib/drizzle.config.ts (upstream ships it empty). If your fork had its own pool values in src/lib/drizzle/index.ts (find them: `git diff <upstream>/main -- src/lib/drizzle/index.ts`, look for max / idle_timeout / connect_timeout), write them into src/config/lib/drizzle.config.ts as camelCase keys, e.g. oripa-do: `export default { max: 50, idleTimeout: 20, connectTimeout: 10 } satisfies DrizzleOverride;` with `import type { DrizzleOverride } from "@/lib/drizzle";`. The file may read process.env; the lib never does.
3. After step 1, `git diff --quiet <upstream>/main -- src/lib/drizzle` must report no difference; then delete the permit row for src/lib/drizzle/index.ts (upreq 20261101-111956-config-drizzle-pool) from .fork-ownership/<your fork name>.permits.txt.
4. `pnpm typecheck` → `pnpm check lib-package` → `pnpm test src/lib/drizzle` → `pnpm workflow ownership check`.
verify: `git diff --quiet <upstream>/main -- src/lib/drizzle` exits 0; `grep -n "src/lib/drizzle/index.ts" .fork-ownership/*.permits.txt` finds nothing; `pnpm check lib-package` exit 0; `pnpm test src/lib/drizzle` passes; `pnpm typecheck`; `pnpm workflow ownership check` reports no src/lib/drizzle edit
manual_steps: -
refs: src/lib/drizzle/README.md, src/lib/drizzle/config.ts, src/lib/README.md 「設定の届け方」, src/lib/defineConfig/README.md, order 20261101-111956-config-drizzle-pool (oripa-do), order 20261108-205014-lib-drizzle-pool-config (council 20261030-212344)
notes: forks without their own pool values only merge (the empty override keeps { prepare: false, max: 3 } exactly). oripa-do checked read-only: its src/lib/drizzle/index.ts passes max 50, idle_timeout 20, connect_timeout 10.
