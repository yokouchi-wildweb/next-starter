---
paths:
  - "src/lib/cacheTags/**"
---
# lib/cacheTags
what: collects the cache tags a write makes stale within a request and revalidates them once at its end (revalidateTag with expire 0) | entry @/lib/cacheTags/server (markCacheTags, runWithCacheTags, cacheTagOf, cacheRowsTagOf, readThrough, defineSharedRead), @/lib/cacheTags (cacheTagOf, cacheRowsTagOf)
use: always
change: none → /order <direct parent>
rules:
using:
- ct_tag_names: build every tag with cacheTagOf (domain tag "<domain>", row tag "<domain>:<id>"), never by hand | the read side's cacheTag uses the same names
- ct_mark_after_write: a write that changes cached data calls markCacheTags with the domain tag and the row tags it wrote | over-marking is harmless, a missed mark leaves stale reads
- ct_entry_scope: runWithCacheTags wraps a whole request at its entry (routeFactory createApiRoute / createDeviceRoute and the cron route already do) | outside a scope (tasks, startup) a mark is logged once and not revalidated
- ct_crud_option: a declared domain's CRUD service passes createCrudService `cacheTags: { domain }` | a raw SQL write calls service.markCacheTags(ids?) right after (no ids = every row)
- ct_shared_read: a shared read of a mechanism that is no domain declaration (analytics) = defineSharedRead(name, read), never a hand-written "use cache: remote" | args and results serializable | one name per read
- ct_rows_tag: get reads carry the row tag and cacheRowsTagOf(domain); writes with unknown rows clear the rows tag
editing:
- ct_never_throw: a failed revalidate never fails the request (the write is committed): log one JSON line and go on
- ct_expire_zero: revalidate with { expire: 0 } (the next read waits for fresh data), never "max" (serves the stale value after a write)
read: wiring an entry, marking writes → Usage | functions, log lines → API | scope, why expire 0, limits → Internals | userDirty, requestMemo → Related
