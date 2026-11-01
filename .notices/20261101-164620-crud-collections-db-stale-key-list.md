# DOWNSTREAM NOTICE id:20261101-164620-crud-collections-db-stale-key-list
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle2-crud-db | commit:(this commit)
date: 2026-11-01T07:46:20Z
severity: info
checkpoint: crud-collections-db-stale-key-list
resolves: 20261031-234503-crud-collections-db-stale-key-list
change: test:crud-collections-db expected key list now includes collectionEntries and collectionEntriesForParents; test only, no runtime change
why: the case failed since those keys were added to collection owners; passing it again lets forks trust this test
required_actions: none
verify: pnpm test:crud-collections-db passes (needs DATABASE_URL; creates and drops its own test_crud_coll_* tables)
manual_steps: -
refs: src/lib/crud/collections/collections.db.test.ts, src/lib/crud/collections/applyCollections.ts, src/lib/crud/README.md
notes: services without the collections option still lack these keys
