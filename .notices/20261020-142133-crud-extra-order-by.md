# DOWNSTREAM NOTICE id:20261020-142133-crud-extra-order-by
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(change ships in the commit that contains this notice)
date: 2026-10-20T05:40:00Z
severity: action-required
checkpoint: crud-extra-order-by
change: createCrudService (Drizzle) `search` / `searchWithDeleted` now accept `extraOrderBy?: SQL[]` (type `ExtraOrderByOption`, exported from `@/lib/crud/drizzle`). ORDER BY = searchRank clause (only with searchQuery) → extraOrderBy → orderBy (or defaultOrderBy) → id (withIdTiebreak). Composition lives in the new pure helper `composeSearchOrderBy(table, orderBy, { rank, extra, base })` (`@/lib/crud/drizzle`). Omitted = identical ordering to before. Server-only: `/api/[domain]/search` builds params from an allowlist and never passes it. count / countWithDeleted / searchForSorting unchanged. CLAUDE.md CRUD_SERVICE search line and src/lib/crud/README.md (### extraOrderBy) document it. This re-adopts the option that 20261020-045541-claude-md-accuracy-fixes removed from CLAUDE.md as phantom.
why: SQL-expression ordering (COALESCE of nullable dates, CASE priority buckets, JSONB values) cannot be expressed by OrderBySpec; without it every such list needs a wrapper that re-implements base search. Forks that carried this as a core edit (oripa-do, and pandora via oripa-do) can drop it.
required_actions:
1. Merge upstream.
2. If your fork has its own `extraOrderBy` edit in `src/lib/crud/drizzle/{service.ts,types.ts,index.ts}` (check: `grep -n "extraOrderBy" src/lib/crud/drizzle/service.ts src/lib/crud/drizzle/types.ts src/lib/crud/drizzle/index.ts` before merging), resolve every conflict in those files by taking upstream's version. The name and shape (`extraOrderBy?: SQL[]`, `ExtraOrderByOption`) and the order (rank → extraOrderBy → orderBy → id) match the fork implementation, so call sites need no change.
3. Forks without such an edit: nothing to do beyond the merge.
verify: `grep -n "composeSearchOrderBy" src/lib/crud/drizzle/service.ts` shows 2 hits (search, searchWithDeleted) | `pnpm test:crud-search-rank` passes | `pnpm tsc --noEmit` passes (existing extraOrderBy call sites still type-check)
manual_steps: -
refs: src/lib/crud/README.md (### extraOrderBy, ### テキスト検索), src/lib/crud/drizzle/query/withIdTiebreak.ts, CLAUDE.md CRUD_SERVICE
notes: Wrappers that build their own ORDER BY via base.query() can reuse composeSearchOrderBy to keep the same order as base search.
