# DOWNSTREAM NOTICE id:20261124-124317-admin-parts-load-required
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261124-124122-admin-parts-load-required | commit:- (this commit)
date: 2026-11-24T12:43:31+09:00
severity: info
checkpoint: admin-parts-load-required
fixes: 20261123-154922-cc-public-loader
pick: clean
resolves: 20261124-124100-admin-parts-load-required
change: the return type of adminListParts / adminEditParts / adminCreateParts / adminSortParts (src/domains/core/admin/services/server/screenParts.ts AdminParts) now has a required load (PageLoaderConfig<…> & { load: NonNullable<…["load"]> }); nothing else changed, createLoader callers are unchanged
why: cc-public-loader made PageLoaderConfig.load optional; a fork loader that composes a part and calls parts.load(ctx, …) failed pnpm typecheck with TS2722 / TS18048 although every part has a load
required_actions: none
verify: pnpm typecheck | git grep -n -E 'Parts\([^)]*\)\.load!|\.load!\(' -- 'src/app/**/loader.ts' lists the non-null assertions you may drop
manual_steps: -
refs: src/domains/core/admin/services/server/screenParts.ts | src/domains/core/admin/services/server/screenData/README.md (API) | src/lib/pageGuard/types.ts PageLoaderConfig | order 20261124-124100-admin-parts-load-required
notes: a non-null assertion (`parts.load!(…)`) or a guard you added after cc-public-loader may be removed (oripa-do J479)
