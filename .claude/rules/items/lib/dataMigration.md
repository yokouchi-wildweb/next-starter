---
paths:
  - "src/lib/dataMigration/**"
---
# lib/dataMigration
what: admin CSV + ZIP export / import in chunks (single domain v1.0, with relations v1.1, media columns bundled) | entry @/lib/dataMigration (DataMigrationButton / DataMigrationModal, export / import cores), routes /api/data-migration/*
use: always
change: none → /order <direct parent>
rules:
using:
- dm_media_source: which columns are media comes from the service's storageFields (createCrudService storage option), never from the client's imageFields
- dm_related_fix_there: v1.1 related rows only fill missing ids → change a related domain by exporting / importing it on its own screen
- dm_import_guard: the import keeps the unsaved guard on (src/lib/unsavedGuard), never an own beforeunload | opt out only with guardUnsaved={false}
editing:
- dm_injected: the lib never imports features or registries | services, junctionTables, domainConfigs and media are injected by the API routes from src/wiring
- dm_chunk_tx: one TX per chunk | stop at the first failed chunk, earlier chunks stay (never undone) | later domains never run without their parent chunks
- dm_media_write: media columns never go through bulkUpsert | values resolve outside the TX, then a per-row update in the chunk TX | one unresolved value (external URL included) fails the whole chunk
- dm_export_priv: private media is read only through storageObjectService.resolveRead as the executor (no implicit admin pass) | unreadable values stay as-is and are reported (mediaSkipped)
- dm_field_types: type conversion reads importValue of src/lib/domain/fields/fieldTypes.mjs, never compares type names
read: export, import, guard → Usage | endpoints, manifest, output, value handling, injection → API | failure stop, related rows, media, deps → Internals | tests → Verification
