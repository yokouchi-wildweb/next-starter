# DOWNSTREAM NOTICE id:20261101-203337-collection-guide-large-table
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle2-crud-db | commit:- (this commit)
date: 2026-11-01T20:33:37+09:00
severity: info
checkpoint: collection-guide-large-table
resolves: 20261028-220623-collection-migration-guide-large-table-fk
change: collection migration guide (src/lib/crud/README.md) gains the large-table caveats: partial index on the new FK column, db:push inside the write stop or column -> CREATE INDEX CONCURRENTLY -> db:push, and step 0 counts run before stopping writes and again right after
why: docs only, nothing to follow up unless a fork is planning this migration on a large referencing table
required_actions: none
verify: `pnpm test:notices` passes
manual_steps: -
refs: src/lib/crud/README.md「既存の mediaUploaderMulti 列からの移行」steps 0, 3, 4; scripts/registry/README.md
notes: not run against a database. Wording rests on oripa-do's report in the order, scripts/registry/README.md and PostgreSQL behaviour. The re-count after the stop and the note that the final db:push still scans for the FK go beyond the order's text. Other forks not checked.
