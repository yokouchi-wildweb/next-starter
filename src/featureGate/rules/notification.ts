// src/featureGate/rules/notification.ts
// お知らせ(サービス内のお知らせ・既読・未読数)とテンプレート。汎用 API /api/notification・/api/notificationTemplate(と自前の /api/notification/**)は features から導く
// テンプレートはお知らせと同じ規則で一緒に閉じる(お知らせの行はテンプレートを外部キーで参照する。同じ機能なので requires は要らない)
// 切り替えの値は今は無い(常に開)。値は土台の後に notification の config.ts で作る(D29)。全体配信の画面は notificationBroadcast.ts、テンプレートの管理画面のスイッチは adminNotificationTemplates.ts

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/notifications",
    "/admin/notification-templates",
  ],
  features: [
    "core/notification",
    "core/notificationTemplate",
  ],
  enabled: () => true,
};
