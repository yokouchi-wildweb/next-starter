// src/featureGate/rules/messagingBroadcast.ts
// 管理の送信(D34・D40): 管理の画面 /admin/messaging/send と API /api/admin/messaging/send(送る・予約・プレビュー・見込み・自分へのテスト・選択肢)。
// 閉の間、画面と API は 404。送る口(sendMessage / sendTemplate)と cron の予約の拾いは門に関わらず動く(domains は持たない)。
// /admin/messaging の下の機能なので messagingDispatches に依存する。管理メニューの行(src/features/core/admin/menu/items/messagingSend.ts)はこの規則の住所で隠れる。
// 入切の既定は閉。fork が開ける値は src/config/featureGate/switches.config.ts

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["messagingDispatches"],
  pathPatterns: [
    "/admin/messaging/send",
    "/api/admin/messaging/send",
  ],
  domains: [],
  defaultEnabled: false,
};
