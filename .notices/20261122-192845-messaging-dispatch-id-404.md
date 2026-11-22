# DOWNSTREAM NOTICE id:20261122-192845-messaging-dispatch-id-404
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-22T19:28:45+09:00
severity: info
checkpoint: messaging-dispatch-id-404
resolves: 20261121-225207-dispatch-id-non-uuid-404
change: The admin dispatch routes (/api/admin/messaging/dispatches/[id] GET / DELETE, [id]/deliveries, [id]/preview, [id]/resend, [id]/continue, /api/admin/messaging/send-results/[dispatchId]) answer 404 "送信が見つかりません" for an id that is not uuid-shaped instead of 500 (PostgresError invalid input syntax for type uuid). The stores that read a dispatch by id (admin/store.ts findDispatch, admin/operationsStore.ts withLockedDispatch / findDispatches, sweep/store.ts findDispatches) treat such an id as a missing dispatch without querying (isDispatchId in src/domains/core/messaging/services/server/dispatchId.ts, shape only, so md5-derived ids of the legacy copy still match).
why: The removed page URL /admin/messaging/send and any mistyped dispatch link reached the API as id "send" and logged a 500 that reads as an outage. No fork action: the behavior changes on merge.
required_actions: none
verify: pnpm test src/domains/core/messaging/services/server/dispatchId.test.ts passes; on a running app GET /api/admin/messaging/dispatches/send as an admin returns 404 with message 送信が見つかりません
manual_steps: -
refs: src/domains/core/messaging/services/server/dispatchId.ts, src/domains/core/messaging/services/server/admin/README.md (Overview), order 20261121-225207-dispatch-id-non-uuid-404 (oripa-do, relayed as quest 20261122-190302-quest-dispatch-id-non-uuid-404)
notes: The detail page /admin/messaging/[id] no longer exists (the detail is a modal on the list since D130), so /admin/messaging/send already shows the app's 404 page; no redirect was added.
