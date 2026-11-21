---
paths:
  - "src/features/core/chatRoom/**"
  - "src/config/features/chatRoom.config.ts"
---
# features/chatRoom
what: realtime chat on Firestore: the browser reads and writes chat_rooms / messages through the chatRoom clients and hooks (hooks/firestore/), no REST in between; the admin screens use the generated CRUD API
use: chatRoom
change: placement → src/config/features/chatRoom.config.ts (attachment content types) | own room types, room fields and message metadata need no core edit (Firestore is schemaless)
rules:
using:
- chat_indexes: create the Firestore composite indexes of Usage「Firestore 複合インデックス」 before use (rooms list, type filter, admin list)
- chat_client_only: write chat_rooms / messages only through the chatRoom clients, never with the default fstore (@/lib/firebase/client): its uid is not users.id for email / OAuth users
- chat_rules: own room types or fields → add them to your own firestore.rules (the shipped example passes only the built-in ones)
- chat_attachment_view: show attachments through resolveStorageSrc / AppImage; list previews switch on `type`, never print the ref
- chat_timestamp_null: date displays handle a null serverTimestamp field
editing:
- chat_snapshot_batch: lastMessageSnapshot is written in the sender's writeBatch, never by a Cloud Functions trigger
- chat_read_at: readAt is written by the chat screen (useReadAt) and own sends only, never by the list listener
- chat_app_internal: the dedicated Firebase app (chatFirebase.ts) stays inside chatRoom, never a public entry
- chat_no_firebase_storage: attachments use lib/storage purposes chatRoom.*, never Firebase Storage
- chat_typing_rtdb: → core/backends.md high_frequency_presence
read: set up, build a screen, extend → Usage | data model, limits → API | sync, rules, attachments → Internals | hooks → src/features/core/chatRoom/hooks/firestore/README.md API | room / message calls → src/features/core/chatRoom/services/client/README.md Usage
