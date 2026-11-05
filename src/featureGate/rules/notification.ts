// src/featureGate/rules/notification.ts
// お知らせ(サービス内のお知らせ・既読・未読数)。汎用 API /api/notification(と自前の /api/notification/**)は features から導く
// 切り替えの値は今は無い(常に開)。値は土台の後に notification の config.ts で作る(D29)。全体配信の画面は notificationBroadcast.ts

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/notifications",
  ],
  features: [
    "core/notification",
  ],
  enabled: () => true,
};
