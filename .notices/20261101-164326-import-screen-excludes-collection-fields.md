# DOWNSTREAM NOTICE id:20261101-164326-import-screen-excludes-collection-fields
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle2-crud-db | commit:(this commit)
date: 2026-11-01T16:43:26+09:00
severity: info
checkpoint: import-screen-excludes-collection-fields
fixes: commit:89951dbc
resolves: 20261101-001013-data-import-screen-collection-fields
change: the data migration import screen no longer sends collection fields (isCollectionFieldType) in `fields`, so a domain with one can be imported from the screen again
why: since 89951dbc the server rejects declared collection fields with 400 and the screen declared them, so the main chunk of such a domain failed; the server check and the export format are unchanged
required_actions: none
verify: pnpm test:data-migration
manual_steps: -
refs: src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/importFieldTypeInfo.ts, src/lib/dataMigration/README.md, src/lib/crud/README.md
notes: collection values still do not travel in CSV/ZIP. Domains without a collection field send the same fields as before.
