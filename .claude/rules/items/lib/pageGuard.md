---
paths:
  - "src/lib/pageGuard/**"
---
# lib/pageGuard
what: the generic page guard: range policies in guard.ts beside a layout and the page access of configured loaders, judged by one evaluator (the page version of lib/routeFactory) | closed lib, entry @/lib/pageGuard only: createPageGuard (bound in the generated src/wiring/pageGuard.ts as defineRootGuard)
use: always
change: replace = the pageGuardUser item (exactly one; upstream auth plugs/pageGuardUser/session.ts, replace point authPageGuardUser) | else none → /order <direct parent>
rules:
using:
- pg_value_import: values of this lib are imported only in src/wiring/** (a guard.ts takes the root from @/wiring/pageGuard, a child from its parent's extend) | types anyone (lint import-boundaries/page-guard-via-wiring)
- pg_display_user: guard() returns no user | a screen shows the user through the root AuthSessionProvider → useAuthSession
- pg_loader_key: a loader's key(props) only picks cache-key primitives from params / searchParams, never fetches data
- pg_extra_access: an extra access check before fetching uses load's allows(rule), not an own role check
editing:
- pg_generic: the lib holds no auth | user resolution, access evaluation, default statuses and the current path come in as the bundle (auth plugs/pageGuardUser item) through src/wiring
- pg_and_only: every policy level is evaluated from the root in order (setup → access) | a child only narrows, never overrides a parent's denial
read: wiring, range files → Usage | policy keys, guard, createLoader → API | level order, bundle → Internals | tests → Verification | page writing → src/lib/screens/README.md Usage
