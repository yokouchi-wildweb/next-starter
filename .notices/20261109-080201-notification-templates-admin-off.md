# DOWNSTREAM NOTICE id:20261109-080201-notification-templates-admin-off
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-08T23:02:01Z
severity: action-required
checkpoint: notification-templates-admin-off
change: Upstream default of APP_FEATURES.adminConsole.enableNotificationTemplates (src/config/app/app-features.config.ts) is now false: the admin screens /admin/notification-templates (list / new / [id]/edit) and the generic API /api/notificationTemplate answer 404, and the 「通知テンプレート」 item leaves the admin menu (marketing). The notificationTemplate domain itself stays open (rule notificationTemplate unchanged): notifications.notification_template_id still references its table, so no db:push and no table change.
why: Templates are not used by any sending path yet (sendFromTemplate is unimplemented, notification README 「将来の拡張」), and the broadcast screen /admin/notifications is already off by default (enableAdminBroadcast: false). The menu rebuild (admin-menu-rebuild) had surfaced the unused template screens in every admin menu. A fork that kept the upstream value sees the screens close silently on merge.
required_actions:
1. Merge upstream up to this checkpoint. In src/config/app/app-features.config.ts take upstream's line `enableNotificationTemplates: false,` unless your fork uses the template admin screens or /api/notificationTemplate; then set it back to `true` (a value change in your config, an intake point).
2. Run `pnpm generate routes` (the three /admin/notification-templates pages are now gatedOff in src/app/route-map.jsonl; the map differs per fork, so regenerate instead of taking upstream's file).
verify: pnpm check admin-menu -- show --role=admin (no 「通知テンプレート」 row unless you set true) | pnpm check routes | FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies
manual_steps: -
refs: src/config/app/app-features.config.ts, src/featureGate/rules/adminNotificationTemplates.ts, src/features/core/admin/menu/items/notificationTemplates.ts, src/features/core/notification/README.md (将来の拡張)
notes: Per fork (read-only grep): 88-base, TriQ, boardgame-site, next-vnx, oripa-do and pandora still have enableNotificationTemplates: true from upstream and no own code reading the template domain or its screens (oripa-do / pandora have their own accountVerification constants/notificationTemplates.ts, unrelated to this domain) → step 1 takes false; voranowa has no such key. Closing the notificationTemplate domain itself would make pnpm db:push throw (a kept table, notifications, references a skipped one) — not done here.
