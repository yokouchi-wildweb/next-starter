---
paths:
  - "src/domains/core/auditLog/**"
  - "src/config/domains/auditLog.config.ts"
---
# domains/auditLog
what: the cross-domain append-only audit trail audit_logs | recorder auditLogger from @/domains/core/auditLog/services/server, client parts from @/domains/core/auditLog, hooks from its hooks/<name>
use: always
change: placement = src/config/domains/auditLog.config.ts (userVisibleActions, actionLabels)
rules:
using:
- interventions_only: record interventions (admin manual ops, policy exceptions, direct writes to a user's assets or permissions) | never business events a business table already traces
- subject_top_level: an op tied to a user passes `subjectUserId` at top level, never in metadata | user target → its id | related record → its owner | none → explicit `null`
- crud_audit_no_subject: the createCrudService `audit:` option never sets a subject → an op that must show in a user's timeline is recorded with record()
- many_in_one_tx: many records of one action in one tx → recordMany / recordManyDiff, never record() awaited in a loop | one call never mixes tx, bestEffort or batchId
- bulk_retention: recommended: user / wallet / payment → bulkMode detail, retention ≥ 730 days | high-frequency → off or 90 days
- strict_default: interventions stay strict | bestEffort only for measurement-like records
- metadata_no_secrets: metadata skips the denylist → no secrets in it | per-domain exclusion = trackedFields
- context_not_authz: the audit context is a recording value, never input to authorization
- server_entry: auditLogger comes from services/server only, never through the client barrel
- timeline_subject: UserActivityTimeline shows only rows with a subject → check the domain records one before embedding it
read: what to record, the 3 axes → Overview | record patterns, timelines → Usage | options, bulkMode, retention, strict → API | visible actions, labels → Extension | context, cron, stop, schema → Internals
