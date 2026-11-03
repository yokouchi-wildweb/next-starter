# DOWNSTREAM NOTICE id:20261103-132000-firestore-where-unsupported-op-throws
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle4 | commit:- (this commit)
date: 2026-11-03T13:20:00+09:00
severity: action-required
checkpoint: firestore-where-unsupported-op-throws
resolves: 20261102-184122-firestore-applywhere-silent-drop
change: the Firestore crud adapter's where reader (src/lib/crud/firestore/query/applyWhere.ts) now throws on any operator other than eq, ne, lt, lte, gt, gte, like (in, notIn, isNull, isNotNull, startsWith, endsWith, contains, containedBy, hasKey, arrayContains, arrayOverlaps); before it dropped the condition silently and returned more rows than asked. No operator was added (adapter frozen)
why: a Firestore domain's search / count / bulkDeleteByQuery / bulkUpdate with such an operator now fails (500) instead of returning or touching unfiltered rows
required_actions:
1. List Firestore domains: git grep -ln '"dbEngine": "Firestore"' -- src/features (and hand-written services built with the Firestore createCrudService)
2. For each, git grep -nE 'op: "(in|notIn|isNull|isNotNull|startsWith|endsWith|contains|containedBy|hasKey|arrayContains|arrayOverlaps)"' -- the domain folder and its callers (hooks, Screens, services); rewrite each hit on a Firestore domain with eq / ne / lt / lte / gt / gte / like, or filter in code after the query
3. pnpm typecheck
verify: pnpm typecheck passes | pnpm test:crud-firestore-where passes | step 2 grep shows no unsupported op on a Firestore domain
manual_steps: -
refs: src/lib/crud/firestore/query/applyWhere.ts, src/lib/crud/firestore/query/applyWhere.test.ts, src/lib/crud/README.md「Firestore 版との差異」
notes: upstream's only Firestore domain is chatRoom; no upstream caller of the dropped ops was found (bundle 2 survey). Forks not checked
