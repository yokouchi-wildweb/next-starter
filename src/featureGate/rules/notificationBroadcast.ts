// src/featureGate/rules/notificationBroadcast.ts
// マーケティング > お知らせ

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/notifications",
    "/api/notification/send",
  ],
  enabled: () => APP_FEATURES.marketing.notification.enableAdminBroadcast,
};
