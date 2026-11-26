---
paths:
  - "src/domains/core/userGroup/**"
  - "src/config/domains/userGroup.config.ts"
  - "src/**/plugs/userGroupCriteria/**"
---
# domains/userGroup
what: named, reusable sets of users (kind dynamic / scheduled / static) | entry services/server: userGroupEvaluator, staticMemberWriter
use: userGroups
change: add = <domain>/plugs/userGroupCriteria/<name>.ts (point userGroupCriteria) | override = <domain>/plugs/userGroupCriteria/<name>.override.ts (enabled, label, description) | counterpart = src/config/domains/userGroup.config.ts
rules:
using:
- not_event_recipients: event recipients (followers etc.) are no group → the calling domain picks users itself, sends as sendMessageToMany `recipients`
- availability_by_caller: a group never filters by availability → the caller applies availableUserWhere (user)
- gate_as_dependency: with userGroups closed the evaluator and writer throw 404 → a domain using groups hides group choices, refuses group operations
- heavy_is_scheduled: isMember on a dynamic group with a heavy part = 409 → make it scheduled
- adhoc_evaluate: conditions for one event → evaluate(definition), never a saved group
- non_sql_static: a condition SQL cannot express → a fork task writes a static group (runAsSystem) and conditions use inStaticGroup
- criterion_sql_only: a criterion returns an SQL predicate on users only, never ids | no Date embedded in raw SQL
- criterion_indexed: a column a criterion reads has an index
- criterion_override_limits: an override never changes key, args or predicate | inStaticGroup cannot be disabled
- limits_stop: count / sendTarget return overLimit, never throw → the caller stops with a reason, never truncates
editing:
- writer_no_audit: staticMemberWriter writes no audit rows, even for a fork task (the admin API records)
- internal_only: the userGroup registration's apiAccess stays INTERNAL_ONLY
read: kinds, limits → Overview | use a group → Usage | evaluator, writer, admin API → src/domains/core/userGroup/API.md API | criteria, config, gate → Extension | tables, recompute → src/domains/core/userGroup/Internals.md Internals
