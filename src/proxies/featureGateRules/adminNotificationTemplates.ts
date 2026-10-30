// src/proxies/featureGateRules/adminNotificationTemplates.ts
// 通知テンプレートの管理(画面と汎用 CRUD)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/notification-templates",
    "/api/notificationTemplate",
  ],
  enabled: () => APP_FEATURES.adminConsole.enableNotificationTemplates,
};
