# DOWNSTREAM NOTICE id:20261113-005401-messaging-screens
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-13T00:54:01+09:00
severity: info
checkpoint: messaging-screens
fixes: 20261111-143012-messaging-switch, 20261112-124043-messaging-broadcast
change: Fixes from the messaging screen check. (1) The audit action names messaging.dispatch.bulkSent (admin bulk send, shipped with 20261111-143012-messaging-switch) and messaging.dispatch.testSent (admin test send, shipped with 20261112-124043-messaging-broadcast) broke the audit name rule (lower snake segments), so auditLogger.record threw after the dispatch was written and the request returned 500; they are now messaging.dispatch.bulk_sent / messaging.dispatch.test_sent, and a guard test checks every messaging audit action literal against the rule. (2) The cancel button of an already cancelled scheduled dispatch now gives the reason cancelled (取り消した回です) instead of not_scheduled. (3) The admin delivery DTO gains errorCode (the code part of last_error, e.g. unsubscribe_key_missing; the provider text stays hidden) and the delivery row shows it as 失敗の理由 (wording in constants/deliveryErrors.ts).
why: Bulk send and test send returned 500 although the messages were sent; a failed delivery showed no cause.
required_actions: none
verify: pnpm test src/features/core/messaging passes
manual_steps: -
refs: src/features/core/messaging/README.md (管理の送信, 回の読む口), council 20261108-120538-system-messaging-templates (legate l2, sheet 03, order 34)
notes: No data fix: the bad names never reached audit_logs (the record call threw before insert). A fork that filters audit logs by the old names (bulkSent / testSent) has no rows to miss; use the new names.
