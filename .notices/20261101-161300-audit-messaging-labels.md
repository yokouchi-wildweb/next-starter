# DOWNSTREAM NOTICE id:20261101-161300-audit-messaging-labels
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:4a4513a1
date: 2026-11-01T16:13:00+09:00
severity: info
checkpoint: -
resolves: 20261101-133024-fix-audit-messaging-labels
change: audit lint requires a subject for messaging.* actions | default labels for messaging.message.sent and messaging.message.failed
why: messaging audit rows showed the raw action name; a fork's auditLogger.record of a messaging.* action without subjectUserId is now flagged
required_actions: none
verify: `pnpm typecheck` and `pnpm lint` pass
manual_steps: -
refs: eslint-rules/audit-action-naming.mjs, src/features/core/auditLog/presenters.ts
notes: checkpoint - : same reason as 20261101-161100-wallet-lock-balance. A fork's AUDIT_ACTION_LABELS still wins over the defaults. Current upstream messaging writes through recordMany, which the rule excludes; the rule has no test, so the new prefix was not seen firing. oripa-do moved its labels to its audit config in 39b93fad2. Other forks not checked.
