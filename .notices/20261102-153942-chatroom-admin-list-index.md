# DOWNSTREAM NOTICE id:20261102-153942-chatroom-admin-list-index
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle2-crud-db | commit:(this commit)
date: 2026-11-02T15:39:42+09:00
severity: action-required
checkpoint: chatroom-admin-list-index
resolves: 20261101-121530-chatroom-firestore-index-definition
change: documented the Firestore composite index the chatRoom admin list needs (chat_rooms: deletedAt ASC, updatedAt DESC) in src/features/core/chatRoom/README.md and docs/setup §6.2 step 6; no code change
why: without it /admin/chat-rooms renders the error page (server-side FAILED_PRECONDITION); nothing in the repo defined it
required_actions:
1. Forks without the chatRoom admin list (feature gate off or not used): nothing to do.
2. Forks with it: create the index in each Firebase project (dev, prod) per src/features/core/chatRoom/README.md「Firestore 複合インデックス」: console by hand, or add it to your own firestore.indexes.json (and "firestore": { "indexes": "firestore.indexes.json" } in your firebase.json) then [user-run] firebase deploy --only firestore:indexes --project <project-id>. Keep firestore.indexes.json fork-local and untracked as before.
3. Optional: if admins use the list's name search box, also create (deletedAt ASC, updatedAt DESC, name DESC) and try one search; upstream did not create or verify it.
verify: open /admin/chat-rooms in each environment; it shows the list, not the error page. Or check that the index is READY in Firebase console → Firestore → Indexes.
manual_steps: index creation per Firebase project (console or firebase CLI); needs a role that can create indexes (the app's service account could not on upstream's dev project)
refs: src/features/core/chatRoom/README.md, docs/setup/Neon_Firebaseなど各種バックエンドサービスの設定方法.md
notes: Name search fails with FAILED_PRECONDITION until its index exists; the definition comes from the error, its behaviour after creation is unverified. Firestore adapter unchanged. Fork state: not checked.
