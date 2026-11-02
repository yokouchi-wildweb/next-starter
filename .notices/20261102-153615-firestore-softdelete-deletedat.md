# DOWNSTREAM NOTICE id:20261102-153615-firestore-softdelete-deletedat
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle2-crud-db | commit:(this commit)
date: 2026-11-02T06:36:15Z
severity: action-required
checkpoint: firestore-softdelete-deletedat
resolves: 20261101-121530-firestore-softdelete-create-deletedat
change: Firestore adapter with useSoftDelete now writes deletedAt:null on create, duplicate, upsert and bulkUpsert; chatRoom createRoomWithSystemMessage (client) writes it too; upsert keeps a soft-deleted row deleted
why: list, search and count filter deletedAt == null, which never matches a missing field, so new rows were invisible there; judged a bug fix inside the freeze (no new method, option, op or query shape)
required_actions:
1. If your project deploys a strict firestore.rules that lists allowed keys on chat_rooms create, add deletedAt (value null) to it. Check this before deploying this change, or client room creation is rejected.
2. Existing rows without deletedAt stay out of the admin list, search and count; get and the user chat (subscribeRooms has no deletedAt filter) keep working. No backfill task ships, as the feature is not yet in use. To show such a row, write deletedAt:null to it (Admin SDK set({ deletedAt: null }, { merge: true }); do not touch updatedAt).
3. Own Firestore domains with useSoftDelete (git grep -n "useSoftDelete: true" -- "src/features/**/firestoreBase.ts") get the same behaviour; client code that creates their documents directly must also write deletedAt:null.
verify: pnpm typecheck passes; pnpm test:crud-firestore-softdelete passes
manual_steps: firestore.rules deploy, if step 1 applies (Firebase console or firebase CLI)
refs: src/lib/crud/firestore/index.ts, src/features/core/chatRoom/services/client/firestoreClient.ts, src/lib/crud/README.md Firestore 版との差異
notes: upsert and bulkUpsert under useSoftDelete now run in a transaction with one read per document; without useSoftDelete nothing changes. Tests use an in-memory fake, not real Firestore. Upstream dev Firestore has 0 chat_rooms. Forks' deployed rules were not checked.
