---
paths:
  - "src/features/core/userGroup/**"
  - "src/config/features/userGroup.config.ts"
---
# features/userGroup
what: named, reusable sets of users (kind dynamic / scheduled / static) | server userGroupEvaluator and staticMemberWriter from @/features/core/userGroup/services/server
use: userGroups
change: add = criteria/<name>.ts (receptacle criteria, pnpm generate extensions) | overlay = criteria/<name>.override.ts (enabled, label, description) | placement = src/config/features/userGroup.config.ts
rules:
using:
- not_event_recipients: recipients of an event are no group: the feature selects users itself and sends to `recipients`
- availability_by_caller: a group never filters by availability → the caller applies user's available predicate
- gate_as_dependency: with userGroups closed the evaluator throws 404 → a feature using groups hides group choices and group operations
- heavy_is_scheduled: a dynamic group with a heavy part cannot answer isMember (409) → make it scheduled
- adhoc_evaluate: conditions for one event → evaluate(definition), never a saved group
- non_sql_static: a condition SQL cannot express → a fork task writes a static group (runAsSystem) and conditions use inStaticGroup
- criterion_sql_only: a criterion returns only an SQL predicate on users, never collects ids | no Date embedded in raw SQL
- criterion_indexed: a column a criterion reads has an index
- criterion_override_limits: an override never changes key, args or predicate | inStaticGroup cannot be disabled
editing:
- limits_stop: over memberLimit stops before sending or writing with a reason, never truncates
- writer_no_audit: staticMemberWriter writes no audit rows (the admin API records)
- internal_only: domainEntry access stays INTERNAL_ONLY
read: kinds, limits → Overview | use a group → Usage | evaluator, writer, admin API → src/features/core/userGroup/API.md API | criteria, config, gate → Extension | tables, recompute → src/features/core/userGroup/Internals.md Internals
