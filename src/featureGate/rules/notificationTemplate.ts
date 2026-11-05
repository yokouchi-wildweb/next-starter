// src/featureGate/rules/notificationTemplate.ts
// お知らせのテンプレート。汎用 API /api/notificationTemplate は features から導く。notification はこれを前提にする(requires)
// 切り替えの値は今は無い(常に開)。値は土台の後に notificationTemplate の config.ts で作る(D29)。管理画面のスイッチは adminNotificationTemplates.ts

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/notification-templates",
  ],
  features: [
    "core/notificationTemplate",
  ],
  enabled: () => true,
};
