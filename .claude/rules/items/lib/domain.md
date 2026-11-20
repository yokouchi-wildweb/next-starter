---
paths:
  - "src/lib/domain/**"
---
# lib/domain
what: reads domain.json copies and settings (fields, relations, junctions) and resolves a domain name ↔ service / table / id column from the registry passed in | entry @/lib/domain (client), @/lib/domain/server, accessPresets, fields/fieldTypes.mjs
use: always
change: overlay → domainEntry.override.ts beside a core domainEntry.ts (replaces `access` only)
rules:
using:
- domain_entry_literals: table / idColumn are string literals or null right after service
- domain_entry_imports: domainEntry(.override).ts value-imports only value-only files | own access presets → a value-only file in your domain (constants/)
- domain_entry_base: an entry service exposing part of the base can't be registered → point service at the base, keep access INTERNAL_ONLY or open only ops safe on the whole base | never add methods just for the test
- domain_data_ops: truncateAll / export / import open only when named in access.operations | being registered is no permission (INTERNAL_ONLY closes the 4 data commands)
- domain_generate_false: a "generate": false domain hand-writes domainEntry.ts in the generator's shape and edits it when apiAccess / useImportExport / plural change
- domain_field_type_add: a new fieldType = a table row (with formDefault) + fieldFormInputs.mjs | the name unions follow from the tables (fields/fieldTypeNames.ts) | look names up as written, no aliases | retire with `retired`
- one_field_type: a type for a domain.json field derives from DomainField, a relation from DomainConfigRelation (Pick or widen it), never a new copy of the keys | the keys' source = FIELD_KEYS / RELATION_KEYS of scripts/structure/domain/spec/domainJson.mjs
- field_type_names: fieldType / formInput name unions come from fields/fieldTypeNames.ts (FieldTypeName, NeonFieldType, FirestoreFieldType, BuiltinFormInput), never a hand-written list
editing:
- domain_presets_const: access presets stay lib constants, never overridable config | the default rule stays fail-closed (admin only)
read: domainEntry, generate:false, config reads, fieldTypes → Usage | functions, presets, display keys, field type, type table → src/lib/domain/API.md API | core access override → Extension | checks, access, commands, display, lint → Internals | tests → Verification
