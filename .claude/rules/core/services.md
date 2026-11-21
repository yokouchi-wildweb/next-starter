---
paths:
  - "src/features/**/{services/server,scripts}/**"
  - "src/lib/crud/**"
  - "src/app/api/**"
  - "src/app/**/_screen/loader.ts"
---
# services
> **ROLE**: loaded when writing server services, loaders or CRUD calls | holds CRUD_SERVICE (createCrudService) service-side rules
> Tier1-owned: forks never edit (gap → /order next-starter)

operations: create, list, get, update, delete, search, count, query, upsert, duplicate, restore, hardDelete, bulk* (DeleteByIds, DeleteByQuery, Upsert, Update, UpdateByIds) | Drizzle-only: belongsToMany, reorder, searchForSorting, replaceByQuery | conditional on domain flags: duplicate, restore/hardDelete, reorder/searchForSorting
search: list = simple full fetch only → relations / filters / pagination use search | options: relationWhere, extraWhere (SQL), extraOrderBy (SQL[], before orderBy, server-only), searchRank, withRelations (depth ≤ 3), hasManyLimit | wrappers that order search results reuse buildSearchWhere / buildSearchRankOrderBy and close ORDER BY with withIdTiebreak (else ties reorder across pages)
reuse_base: never re-implement what base CRUD already provides (operations above, search options) | many-to-many → belongsToMany, never a hand-built m2m when it is available (Drizzle only)
extension: 1.base methods → 2.relationWhere → 3.extraWhere / extraOrderBy → 4.base.query() + wrappers → 5.custom service | files: \<domain\>Service.ts (import only), wrappers/ (CRUD overrides), \<other\>/ (domain-specific)
system_write: systemUpdate / systemBulkUpdateByQuery bypass Zod for allowlisted systemColumns → service layer ONLY, never wire to HTTP routes
raw_sql (MANDATORY): never embed a JS Date in a raw sql`` template (Postgres cannot parse it → 500) → pass .toISOString(), Drizzle operators (eq / gt / between …) take Date as is | lint raw-sql-date/no-date-param (all tiers error; members like opts.at need types → not seen) | a raw SQL write to a requestMemo-enabled table → the memo line below
- memo: a raw SQL write to a requestMemo-enabled table (user, setting) → call the service's invalidateRequestMemo() right after (base.invalidateRequestMemo() in a wrapper)
media_columns (MANDATORY): media (storage:// ref) columns are written only through the createCrudService storage binding or storageObjectService.attach | raw SQL, systemUpdate and copying a ref into another table are prohibited (share = copy) | before uploading / reading / deleting files → read src/lib/storage/README.md
media_fk_cascade: a media table may have an FK onDelete cascade to its parent | DB-deleted rows skip the binding → storage-sweep reconciliation detaches them and removes the file on a later run (not at once) | ref: src/lib/crud/storageIntegration/README.md, src/features/core/storageObject/README.md Internals
media_value_check: the sweep also checks that the row's column still holds the ref (dropped column / raw SQL / migration) → storageObjectConfig.sweep.reconcile.valueCheck "report" (default, warn only) | "detach" only after reading the report | media columns cannot be hiddenColumns (createCrudService throws) | ref: src/features/core/storageObject/README.md Internals
hiddenColumns: secrets declared with defineHiddenColumns (business: domain.json hiddenColumns) are nulled in every service return and relation embed | read them only through a dedicated finder (e.g. user findByIdWithSecrets), never return them over HTTP | raw drizzle select / returning bypasses this → full rows via getPublicColumns(<Table>) (lint hidden-columns/no-raw-select = error)
domain_error: a server service throws DomainError for what the user must see (its message is shown as is) | an API route handler never throws a new one | ref: src/lib/errors/README.md
db_aggregation: aggregate in SQL (GROUP BY), never fetch rows and sum in JS
tx_side_effects: inside a service transaction write through the passed tx | side effects outside the DB (mail, external calls) go after it commits
tx_reads: reads inside an open transaction go through the tx executor
use_cache: a shared "use cache" / "use cache: remote" never reads the user or permissions outside its arguments (session / guard APIs, cookies / headers, getAuditContext) → resolve them in the caller and pass them as arguments, or "use cache: private" | lint use-cache/no-principal-outside-args (direct calls only)
