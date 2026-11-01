# DOWNSTREAM NOTICE id:20261101-170851-collections-on-query-path
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle2-crud-db | commit:(this commit)
date: 2026-11-01T08:08:51Z
severity: action-required
checkpoint: collections-on-query-path
resolves: 20261028-220144-collections-on-query-path
change: a collection owner's base.query() now attaches every collection field (all values, sort order) to rows with a top-level string or number id; rows without one get no such field; one extra query per collection per call
why: owner rows from base.query() silently lacked collections, so re-attach workarounds are now redundant, and selects that rely on the old behaviour change meaning
required_actions:
1. Find owner wrappers: git grep -n "base.query\|collectionEntriesForParents" -- src/features . Own attach helpers called on base.query() results count too.
2. Remove re-attach calls made right after base.query() when the select has a top-level owner id. They now cost a duplicate query. oripa-do: drop the attachGenericImages call and import in src/features/prizeItem/services/server/wrappers/search.ts.
3. Keep helpers for selects that bypass the service or have no top-level id, such as select({ item: table }). oripa-do: keep attachGenericImages for prizeExchange getCounterStateForUser.ts.
4. For each base.query() on an owner, fix two cases: `id` holding another table's id gets the wrong children, so output it under another name; an output key equal to a collection field name is overwritten on rows with an id, so rename it.
verify: pnpm typecheck passes; pnpm test:crud-collections-db passes (needs DATABASE_URL; creates and drops its own test_crud_coll_* tables)
manual_steps: -
refs: src/lib/crud/collections/applyCollections.ts, src/lib/crud/README.md 読み出し, order 20261028-220144-collections-on-query-path
notes: services without the collections option are unchanged. The other 7 read methods are unchanged. Only oripa-do was named by the order; other forks not checked.
