// src/featureGate/rules/notification.ts
// お知らせ(サービス内のお知らせ・既読・未読数)とテンプレート。汎用 API /api/notification・/api/notificationTemplate(と自前の /api/notification/**)は domains から導く
// テンプレートはお知らせと同じ規則で一緒に閉じる(お知らせの行はテンプレートを外部キーで参照する。同じ機能なので requires は要らない)
// 入切の既定は開(defaultEnabled: true)。fork が閉じる値は src/config/featureGate/switches.config.ts(D35)。
// 全体配信の画面 /admin/notifications は notificationBroadcast.ts、テンプレートの管理画面 /admin/notification-templates は adminNotificationTemplates.ts だけが持つ(どちらも notification に dependsOn)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [],
  domains: [
    "core/notification",
    "core/notificationTemplate",
  ],
  defaultEnabled: true,
};
