# DOWNSTREAM NOTICE id:20261030-100428-import-value-shape
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-30T10:04:28+09:00
severity: info
checkpoint: import-value-shape
change: CSV import (src/lib/dataMigration/import/importChunk.ts) reads dates, times and numbers by the field-type table's new `importValue` attribute (src/lib/domain/fields/fieldTypes.mjs, `importValueShape`) instead of lower-casing type names. Changed results for the main domain: `time` columns keep their value ("10:30" stays "10:30"; before, it was read as a date and became null, so imported times were lost; blank → null; an invalid value now fails the row at the DB write); `numeric(10,2)` becomes a number ("12.50" → 12.5, unreadable → null; before, it stayed a string); type names not in the table (e.g. lower-case "timestamp with time zone", "decimal") stay text (before, they were read as date / number). Unchanged: date, timestamp, timestamp With Time Zone, integer, number, float, bigint, array / stringArray, boolean, string, jsonb, media. The field-type guard lint no longer allowlists src/lib/dataMigration/import/**. getFieldTypes now also returns timeFields and convertRecordTypes takes that object (internal API).
why: The table is the one place that gives a field type its meaning (D14 / D32); the lower-cased name comparison silently dropped time values and left numeric values as strings.
required_actions: none
verify: `pnpm test:data-migration`
manual_steps: -
refs: src/lib/domain/fields/fieldTypes.mjs (importValue, importValueShape), src/lib/dataMigration/import/importChunk.ts, src/lib/dataMigration/README.md「仕様上の注意点」, council report 20261028-234023-field-type-single-interpretation (D32)
notes: Changed rows approved by the human (council decision L1.25). | CSV files and exports do not change; no generated file changes. | Forks with domain.json types outside the table: such columns are imported as text now; domains without `useImportExport: true` are closed for import anyway (notice 20261029-203513-domain-strict-checks). | No DB change. | For oripa-do's downstream (pandora; oripa-do relays this note as is): the same applies in pandora.
