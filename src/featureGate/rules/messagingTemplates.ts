// src/featureGate/rules/messagingTemplates.ts
// 保存されたテンプレート(D40・D41): 管理の画面 /admin/messaging/templates(一覧・作る・[id] の編集)と
// 管理の API /api/admin/messaging/templates(一覧・作成・下書き・公開・取り下げ・版・画面の選択肢)。
// 閉の間、画面と API は 404。表とテンプレートの画像の台帳の紐付けは門に関わらず残る(domains は持たない)。
// /admin/messaging の下の機能なので messagingDispatches に依存する。管理メニューの行(src/features/core/admin/menu/items/messagingTemplates.ts)はこの規則の住所で隠れる。
// 入切の既定は閉。fork が開ける値は src/config/featureGate/switches.config.ts

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["messagingDispatches"],
  pathPatterns: [
    "/admin/messaging/templates",
    "/api/admin/messaging/templates",
  ],
  domains: [],
  defaultEnabled: false,
};
