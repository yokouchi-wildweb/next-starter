---
paths:
  - "src/lib/crud/**"
---
# lib/crud
what: createCrudService (Drizzle, frozen Firestore) + hooks, client, CRUD buttons (@/lib/crud, /drizzle, /hooks, /client, /components)
use: always
change: none → /order <direct parent>
rules:
using:
- upsert_full_shape: upsert takes a full Insert; partial change → update()
- hidden_decl_place: defineHiddenColumns right after the table in entities/drizzle.ts
- coll_no_bulk: collection values never go through bulk* or replaceByQuery (400)
- coll_fk_ref: pointing at one collection item = an FK to the child row id (SET NULL), never a copied value
- coll_hand_wiring: a hand-written drizzle.ts / drizzleBase.ts adds defineTableCollections and passes collections itself
- coll_dup_wrapper: a wrapper replacing duplicate calls duplicateWithCollections; duplicateStorageValues only for duplicating
- coll_migrate: moving a mediaUploaderMulti column = collections/Usage.md, direct SQL (never empty it by a service save)
- sort_key_sql: own SQL or index on a sort key uses sortKeyExpr / sortKeyIndexColumn (COLLATE "C")
- buttons_refetch: CRUD buttons over client-fetched data refetch in onSuccess (bulk: also clear selection)
- hooks_generated: never edit generated domain hooks; derived hooks go beside them under other names
editing:
- types_optional: additions to shared types (SearchParams …) are optional only
- firestore_side: a Drizzle-only addition says if Firestore ignores or throws
- query_pure: query/ builders stay pure functions (no DB access)
- field_type_from_domain: presenters read domain.json fields, relations and tableFields through lib/domain's types (DomainField, DomainDisplayRelation, DomainDisplay; Pick) | never a shape of crud's own
- hooks_reach: a generated hook signature change goes to the template and the lib together (every domain)
- coll_names: a collections rename rewrites every upstream caller and keeps no old name (fork callers get the old → new table in the notice); CrudCollectionConfig grows by optional keys only
read: options, methods, list columns → API | hooks contract → Internals | storage → src/lib/crud/storageIntegration/README.md Usage | collections → src/lib/crud/collections/README.md Usage | search → src/lib/crud/drizzle/query/README.md API | hooks → src/lib/crud/hooks/README.md Usage
