// src/featureGate/rules/notificationBroadcast.ts
// マーケティング > お知らせ(全体配信。お知らせ notification の送り口なので notification に dependsOn)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["notification"],
  pathPatterns: [
    "/admin/notifications",
    "/api/notification/send",
  ],
  enabled: () => APP_FEATURES.marketing.notification.enableAdminBroadcast,
};
