// src/featureGate/rules/adminNotificationTemplates.ts
// 通知テンプレートの管理(画面と汎用 CRUD)。テンプレートはお知らせ(notification)の機能の一部なので notification に dependsOn

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["notification"],
  pathPatterns: [
    "/admin/notification-templates",
    "/api/notificationTemplate",
  ],
  defaultEnabled: false,
};
