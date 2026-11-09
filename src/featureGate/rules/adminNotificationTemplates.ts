// src/featureGate/rules/adminNotificationTemplates.ts
// 通知テンプレートの管理画面。テンプレートはお知らせ(notification)の機能の一部なので notification に dependsOn。
// テンプレートの汎用 API /api/notificationTemplate はテンプレートのドメインの導出(お知らせの機能 notification が features に持つ)で、
// ドメインの開閉で決まる(D24・D25・D34 K4)。この管理画面を閉じても、お知らせが開いていれば API は開(API は管理者だけ)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["notification"],
  pathPatterns: [
    "/admin/notification-templates",
  ],
  defaultEnabled: false,
};
