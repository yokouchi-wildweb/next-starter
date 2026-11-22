---
paths:
  - "src/lib/pathPattern/**"
---
# lib/pathPattern
what: URL path pattern matching (segment-boundary prefix, `=` exact, `*` = one non-empty segment, does a pattern cover a route), used by the feature gate, the route map and their checks; entry @/lib/pathPattern/index.mjs
use: always
change: none → /order <direct parent>
rules:
using:
- pp_exact: a pattern that must not cover pages a fork adds under the same URL is written exact (`=/mypage`)
- pp_import: import `@/lib/pathPattern/index.mjs` (TS does not resolve a folder's index.mjs)
editing:
- pp_pure: pure functions only, no Node built-ins and no domains (it runs in the proxy, Node tools and tests)
- pp_mjs: it stays .mjs so Node tools without tsx read the same file
read: pattern syntax → Usage | functions → API | who uses it → Related
