---
paths:
  - "src/lib/domain/**"
---
# lib/domain
what: a domain's definition and fields: domain.json reading, field types with their schema and display helpers (CRUD_ID_FIELD, nullableDatetime / requiredDatetime, format* / FieldPresenter), relations, the domain's routes (getAdminPaths / AdminPaths); and resolves a domain name ↔ service / table / id column from the registry passed in
  - closed lib: entry "." @/lib/domain (client and server, no React value code / hooks / HTTP client), "./server" @/lib/domain/server (registry lookups, getJunctionTable), "./node" src/lib/domain/node.mjs (the 5 .mjs tables for scripts / eslint-rules)
  - access types and presets → @/lib/domainAccess
use: always
change: override → domainEntry.override.ts beside a core domainEntry.ts (replaces `access` only)
rules:
using:
- domain_entry_literals: table / idColumn are string literals or null right after service
- domain_entry_imports: domainEntry(.override).ts value-imports only value-only files: presets and operation names from @/lib/domainAccess, types from @/lib/domain (type-only) | own access presets → a value-only file in your domain (constants/)
- domain_entry_base: an entry service exposing part of the base can't be registered → point service at the base, keep access INTERNAL_ONLY or open only ops safe on the whole base | never add methods just for the test
- domain_data_ops: truncateAll / export / import open only when named in access.operations | being registered is no permission (INTERNAL_ONLY closes the 4 data commands)
- domain_generate_false: a "generate": false domain hand-writes domainEntry.ts in the generator's shape and edits it when apiAccess / useImportExport / plural change
- domain_field_type_add: a new fieldType = a table row (with formDefault) + fieldFormInputs.mjs | the name unions follow from the tables (fields/fieldTypeNames.ts) | look names up as written, no aliases | retire with `retired`
- one_field_type: a type for a domain.json field derives from DomainField, a relation from DomainConfigRelation (Pick or widen it), never a new copy of the keys | the keys' source = FIELD_KEYS / RELATION_KEYS of scripts/structure/domain/spec/domainJson.mjs
- field_type_names: fieldType / formInput name unions come from fields/fieldTypeNames.ts (FieldTypeName, NeonFieldType, FirestoreFieldType, BuiltinFormInput), never a hand-written list
editing:
- domain_entries: an entry lists its names one by one (no export *: tsx test readers lose the names) | "./node" stays plain JS without React / Next (eslint rules and generators load it with plain node)
- domain_no_access_reexport: access types and presets live in @/lib/domainAccess only, never re-exported here
- domain_no_client: "." holds no React value code, hooks or HTTP client (data reads and writes, the admin truncate list included, live in @/lib/crud; domain never reads crud)
read: domainEntry, generate:false, config reads, fieldTypes → Usage | functions, presets, display keys, field type, type table → src/lib/domain/API.md API | core access override → Extension | checks, access, commands, display, lint → Internals | tests → Verification
