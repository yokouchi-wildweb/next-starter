# DOWNSTREAM NOTICE id:20261101-192021-sort-key-index-recipe
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle2-crud-db | commit:(this commit)
date: 2026-11-01T19:20:21+09:00
severity: action-required
checkpoint: sort-key-index-recipe
fixes: 20261027-192133-sort-key-collation
resolves: 20261028-171627-sort-collation-index-recipe-roundtrip
change: added sortKeyIndexColumn (src/lib/crud/drizzle/fractionalSort/sortKeyOrder.ts), the round-trip-safe declaration of a COLLATE "C" index on a sort key, single or composite; step 2 of 20261027-192133-sort-key-collation is wrong
why: step 2's sql`${table.sort_order} COLLATE "C"` is rebuilt (DROP + CREATE) on every push, single-column too, which write-locks exactly the large tables it was meant for
required_actions:
1. Find declarations from the old recipe: git grep -n 'COLLATE "C"' -- 'src/features/**/drizzle.ts'. None and no sort index you want to fix: nothing more to do. Do not add an index only because of this notice.
2. For each one, import { sortKeyIndexColumn } from "@/lib/crud/drizzle/fractionalSort/sortKeyOrder" and declare index("<new name>").on(table.parent_id, sortKeyIndexColumn(table.sort_order)) (plain columns before it stay plain). Give it a NEW index name: push does not compare this setting, so under the same name a plain physical index stays plain.
3. [user-run] pnpm db:push (renamed index = one DROP + CREATE; write lock on a large table, so run at low traffic)
4. pnpm db:push:check must report zero statements.
verify: pnpm typecheck && pnpm test:crud-sort-collation-db && pnpm db:push:check
manual_steps: -
refs: src/lib/crud/README.md, scripts/registry/README.md, src/lib/crud/drizzle/fractionalSort/sortKeyIndex.db.test.ts
notes: Ascending NULLS LAST only; the helper rejects desc and nullsFirst. It relies on drizzle-kit emitting the opclass field raw and not comparing it; sortKeyIndex.db.test.ts fails if an upgrade changes that, so run it after upgrading drizzle-kit. Upstream declares no sort index and needs no db:push for this notice. Fork state: not checked.
