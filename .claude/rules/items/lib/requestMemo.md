---
paths:
  - "src/lib/requestMemo/**"
---
# lib/requestMemo
what: request-scoped memoization that can be invalidated on writes (keeps read-your-writes inside a request) | entry @/lib/requestMemo (createRequestMemo) | CRUD option `requestMemo: true` of createCrudService
use: always
change: none → /order <direct parent>
rules:
using:
- rm_crud_first: a CRUD service turns it on with createCrudService `requestMemo: true` before any manual wiring
- rm_raw_write: a raw SQL write to a memoized table calls base.invalidateRequestMemo() right after | first try systemUpdate / systemBulkUpdateByQuery / bulkUpdateByQuery to stay on the CRUD path
- rm_manual_invalidate: a manual memo invalidates after every write path
- rm_what: memoize only identity-stable, high fan-in, rarely written reads | never list / search / count, cross-request caches (withAnalyticsCache) or realtime polling
- rm_immutable: memoized results are shared objects → never mutate them
- rm_tx_read: reads inside an open transaction go through the tx executor
editing:
- rm_failure: a rejected promise is never cached | write methods invalidate even when they fail
read: CRUD option, manual memo, what to memoize → Usage | options → API | contexts, limits → Internals | crud, analytics cache → Related
