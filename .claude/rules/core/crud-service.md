---
paths:
  - "src/features/**"
  - "src/lib/**"
  - "src/hooks/**"
  - "src/app/api/**"
  - "scripts/**"
---
# CRUD_SERVICE (createCrudService)
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /upreq) | FORMAT_RULE applies

operations: create, list, get, update, remove, search, count, query, upsert, duplicate, restore, hardDelete, bulk* (DeleteByIds, DeleteByQuery, Upsert, Update, UpdateByIds) | Drizzle-only: belongsToMany, reorder, searchForSorting, replaceByQuery | conditional on domain flags: duplicate, restore/hardDelete, reorder/searchForSorting
search: list = simple full fetch only → relations / filters / pagination use search | options: relationWhere, extraWhere (SQL), extraOrderBy (SQL[], before orderBy, server-only), searchRank, withRelations (depth ≤ 3), hasManyLimit | wrappers that order search results reuse buildSearchWhere / buildSearchRankOrderBy and close ORDER BY with withIdTiebreak (else ties reorder across pages)
extension: 1.base methods → 2.relationWhere → 3.extraWhere → 4.base.query() + wrappers → 5.custom service | files: \<domain\>Service.ts (import only), wrappers/ (CRUD overrides), \<other\>/ (domain-specific)
hooks: one use\<Op\>\<Domain\> per operation | custom mutation hooks MUST build on useDomainMutation (@/lib/crud/hooks); useSWRMutation PROHIBITED | test: pnpm test:crud-hooks
system_write: systemUpdate / systemBulkUpdateByQuery bypass Zod for allowlisted systemColumns → service layer ONLY, never wire to HTTP routes
raw_sql (MANDATORY, no lint guard): never embed a JS Date in a raw sql`` template (Postgres cannot parse it → 500) → pass .toISOString(), Drizzle operators (eq / gt / between …) take Date as is | a raw SQL write to a requestMemo-enabled table (user, setting) → call base.invalidateRequestMemo() right after
media_columns (MANDATORY): media (storage:// ref) columns are written only through the createCrudService storage binding or storageObjectService.attach | raw SQL, systemUpdate and copying a ref into another table are prohibited (share = copy) | before uploading / reading / deleting files → read src/lib/storage/README.md
media_fk_cascade (recommended): a media table may have an FK onDelete cascade to its parent (DB-deleted rows skip the binding → ledger stays bound, file stays until a ledger reconciliation lands) | to clean at once (optional): restrict + delete children through the child service in the parent's delete | test: pnpm test:storage-purposes warns, never fails | ref: src/lib/crud/README.md「storage オプション」
hiddenColumns: secrets declared with defineHiddenColumns (business: domain.json hiddenColumns) are nulled in every service return and relation embed | read them only through a dedicated finder (e.g. user findByIdWithSecrets), never return them over HTTP | raw drizzle select / returning bypasses this → full rows via getPublicColumns(<Table>) (lint hidden-columns/no-raw-select = error)
