# DOWNSTREAM NOTICE id:20261115-122000-audit-action-lint-injected
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-15T12:20:00+09:00
severity: action-required
checkpoint: audit-action-lint-injected
change: ESLint audit/action-naming (error, every tier, already in required-rules) now also checks audit inputs that do not go to auditLogger directly: any object literal with both `action` and `targetType` (the AuditRecordInput shape) is treated as an audit input whatever it is passed to (an injected deps.recordAudit, recordMany array elements, an input kept in a variable). Checked values: string literals, templates without expressions, ternaries of those; and when `action` is a parameter of the enclosing named function passed through as is (`function audit(group, action) { recordAudit({ ..., action }) }`), the literal arguments at that position in the same file. Other dynamic values are not reported (runtime validateActionName still throws). No domain list or registration; existing valid names keep passing; src/lib/audit/validation.ts unchanged. New rule test eslint-rules/audit-action-naming.test.mjs. auditLog README「action 命名」 and .claude/rules/core/audit.md action_naming updated.
why: messaging.dispatch.bulkSent / testSent passed every check because the literal went through an injected recordAudit, then failed at runtime (500 after the dispatch was written; fixed in a5ff89a58 with a messaging-only test). The check belongs to the audit owner, repo-wide.
required_actions:
1. After merging up to this checkpoint run `pnpm lint`; each new audit/action-naming error in fork files is a name that throws at runtime today: rename it to lower snake per segment (`<domain>.<entity>.<verb_past>`, e.g. bulkSent → bulk_sent). If audit logs with the old name were never written (it threw), no data migration is needed.
2. A false positive (an object with action + targetType that is not an audit input) → `// eslint-disable-next-line audit/action-naming -- <reason>`.
verify: pnpm lint (no audit/action-naming errors) | pnpm test eslint-rules/audit-action-naming.test.mjs
manual_steps: none
refs: eslint-rules/audit-action-naming.mjs, src/features/core/auditLog/README.md「action 命名」, .claude/rules/core/audit.md, src/lib/audit/validation.ts, order 20261113-124832-audit-action-lint-injected (council 20261108-121138)
notes: Not seen: an action passed through more than one helper, through a helper in another file, or through object members; those still rely on the runtime check. The messaging-only guard test (src/features/core/messaging/services/server/auditActions.test.ts) stays as is.
