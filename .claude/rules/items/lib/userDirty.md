---
paths:
  - "src/lib/userDirty/**"
---
# lib/userDirty
what: collects within a request the user ids whose derived data must be recomputed and hands them to the registered handlers once after the request (after the commit) | entry @/lib/userDirty/server only (node AsyncLocalStorage; no `.` entry)
use: always
change: none → /order <direct parent>
rules:
using:
- ud_mark_only: business code calls markUserDirty(userId) inside its write and nothing else (no DB, no wait) | over-marking is harmless, the recompute is idempotent from the source
- ud_entry_scope: runWithUserDirtyTracking wraps a whole request at its entry (routeFactory createApiRoute / createDeviceRoute already do) | outside a scope (tasks, cron, seed) a mark is dropped: keep a periodic full recompute as the safety net
- ud_handler_downstream: the recompute lives downstream, registered once at startup with registerUserDirtyFlushHandler | upstream registers none
editing:
- ud_never_throw: a failed handler never fails the request (the write is committed): log one line and go on
- ud_flush_finally: flush in finally, so a thrown handler still flushes what was marked
read: wiring an entry, marking, registering a handler → Usage | functions → API | scope, failure, why over-marking is safe → Internals | cacheTags, incrementalRefresh → Related
