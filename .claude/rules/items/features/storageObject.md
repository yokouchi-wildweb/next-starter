---
paths:
  - "src/domains/core/storageObject/**"
  - "src/config/domains/storageObject.config.ts"
---
# domains/storageObject
what: the file ledger storage_objects: upload grants, commit (check, strip images re-rendered), discard, private reads, binding to business rows | storageObjectService, routes /api/me/storage/uploads, /api/storage/objects, /api/storage/purposes | parts in @/lib/storage
use: always (in no rule's domains)
change: add = purposes/<name>.ts (receptacle purposes) | placement = src/config/domains/storageObject.config.ts
rules:
using:
- purpose_gate: a purpose reading a closable feature's table checks gate.enabled on upload (read stays open)
- commit_ref: business rows store the ref from the commit response, not from issue
- server_owner: putFromServer / copy owner = the real user, null for cron / system
- copy_outside_tx: run putFromServer / copy before the DB TX or lock when you can (strip re-render cost)
- detach_after_report: switch valueCheck to "detach" only after checking the "report" output
- public_cache: a document promising deletion → a private purpose, or state that public files may stay in caches
- grant_lifetime: never promise uploads die right at the deadline (session URI ~1 week, PUT URL until expiry)
- new_record_type: a record_type outside the registry → /order <direct parent> (task.override.ts cannot add one)
- media_not_hidden: media columns are never hiddenColumns
- unattached_sweep: a ready file attached to no business row is deleted by storage-sweep after unattachedGraceSec (default 24 h) | a purpose with attach: false is the exception
editing:
- fail_closed: unknown purpose 400 | allow AND check | no implicit admin / system pass
- no_http_bind: attach / detach run only inside the business TX, never over HTTP
- session_uri: session_uri is read only by finders/findStorageObjectById.ts
- plain_index: indexes on plain columns only (push round-trip)
read: duties, flow → Overview | cascade, inbox images, user delete → Usage | routes, ledger → API | purposes, config → Extension | rules, sweep, reconcile → Internals | tests, checks → Verification
