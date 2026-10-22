# DOWNSTREAM NOTICE id:20261022-200000-notification-read-visibility-setup-ratelimit
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-22T20:00:00+09:00
severity: action-required
checkpoint: notification-read-visibility-setup-ratelimit
change: SECURITY, 2 items. (1) `notificationService.markAsRead(notificationId, viewer: NotificationViewer)` (was `(notificationId, userId: string)`) now checks the same visibility as the user notification list (buildVisibilityWhere) and throws DomainError 404 for invisible / missing / non-uuid ids; POST /api/notification/[id]/read passes `notificationViewerFromSession(session)`. (2) POST /api/setting/setup gets rate limit category `adminSetup` (new key in src/config/app/rate-limit.config.ts: 10 / hour / IP) and returns `{ success: true }` instead of the created user row; `adminSetupClient.initialize` / `useAdminSetup` now type the result as `AdminSetupResult`.
why: (1) any logged-in user could create read rows for notifications not addressed to them (other users' individual notifications, other roles), polluting admin read counts / reader lists. (2) the public one-shot setup route had no rate limit and returned the whole user row.
required_actions:
1. Merge upstream. In src/config/app/rate-limit.config.ts (fork-editable values file) keep the upstream `adminSetup` key; adjust its numbers only if your ops need it.
2. Fix fork callers of the old signature (tsc reports them): `grep -rn "markAsRead(" src --include=*.ts --include=*.tsx` → for server calls to `notificationService.markAsRead(id, userId)` pass a NotificationViewer instead (`notificationViewerFromSession(session)` from "@/features/core/notification/services/server/notification/viewer", or `{ userId, role }` from a DB-synced user). Do not bypass the visibility check by inserting into notification_reads directly.
3. If fork code consumed the user object returned by POST /api/setting/setup or `useAdminSetup().trigger(...)`, read what it needs from the DB / session instead (the response is now `{ success: true }`).
verify: `npx tsc --noEmit` passes | `grep -rn "markAsRead(.*userId)" src --include=*.ts` returns nothing in server code
manual_steps: -
refs: src/features/core/notification/services/server/notification/markAsRead.ts, src/app/api/notification/[id]/read/route.ts, src/features/core/notification/README.md (markAsRead), src/app/api/setting/setup/route.ts, src/config/app/rate-limit.config.ts (adminSetup), src/features/core/setting/README.md (初期セットアップのセキュリティモデル)
notes: No DB change. Notification routes still build the viewer from the token-only session (JWT role); that wider issue is tracked separately as upstream request 20261022-122913-admin-routes-token-only-role-check. Forks: not checked.
