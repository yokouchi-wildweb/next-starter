# DOWNSTREAM NOTICE id:20261103-125018-data-import-partial-failure
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-03T12:50:18+09:00
severity: action-required
checkpoint: data-import-partial-failure
resolves: 20261102-184122-data-import-partial-failure
change: Admin data import (DataMigrationModal import tab) now stops at the first failed chunk: later chunks and later domains (main / hasMany / junction after a failed parent) are not sent, and the result panel shows "インポート失敗（途中で停止）" with what is in the DB (committed chunks, kept) and what is not (failed + not-run chunks). onImportSuccess still fires when any chunk committed (list refresh). v1.1 related-domain chunks are insert-only: existing related rows (same id) are left untouched, missing ones are created (importChunk existingRowsFor → bulkUpsert skipDuplicates).
why: A failed chunk used to be followed by the remaining chunks and the junction chunk, and the panel read as a success. Every import with relations re-upserted all related rows and rewrote their timestamps.
required_actions:
1. Merge upstream up to this checkpoint.
2. If fork code builds its own result view from ImportResultData or calls importServiceChunk directly: nothing breaks (new fields stoppedAt / notRunChunks and option existingRows are optional, default update). Find callers with `git grep -n "importServiceChunk\|ImportResultData" -- src ':!src/lib/dataMigration'`.
verify: `pnpm typecheck` | `pnpm test:data-migration`
manual_steps: Tell admins who edited related rows inside an export ZIP and re-imported it through the main domain that those edits are no longer applied to existing rows; import the related domain from its own admin screen instead.
refs: src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/importRun.ts, src/lib/dataMigration/import/importChunk.ts, src/lib/dataMigration/README.md「失敗したとき」「関連ドメイン（related）は無い行だけ足す」
notes: Checked with pure-function tests only (runner stop / not-run list, related mode options and row matching); the browser path and a real-DB run were not done (no dev server).
