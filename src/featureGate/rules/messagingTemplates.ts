// src/featureGate/rules/messagingTemplates.ts
// 保存されたテンプレート(D40・D41): 管理の API /api/admin/messaging/templates(一覧・作成・下書き・公開・取り下げ・版)。
// 閉の間、API は 404。表とテンプレートの画像の台帳の紐付けは門に関わらず残る(domains は持たない)。
// /admin/messaging の下の機能なので messagingDispatches に依存する。住所は今は API だけ(管理の画面の住所は画面と一緒に足す)。
// 入切の既定は閉。fork が開ける値は src/config/featureGate/switches.config.ts

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["messagingDispatches"],
  pathPatterns: [
    "/api/admin/messaging/templates",
  ],
  domains: [],
  defaultEnabled: false,
};
