// src/featureGate/rules/messagingDispatches.ts
// 送った回の管理画面(一覧 /admin/messaging・1 件 /admin/messaging/[id])と、その読む口・続きを送るの管理 API(連絡の議会 D37・D42)。
// 管理の一括送信 /api/admin/messaging/bulk-send はこの規則に入れない(管理一覧の一括操作の項目が使うので、画面を閉じても送れる)。
// 表は連絡の基盤なので domains は持たない。管理メニューの行(src/features/core/admin/menu/items/messagingDispatches.ts)はこの規則の住所で隠れる。
// 入切の既定は開(defaultEnabled: true)。fork が閉じる値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/messaging",
    "/api/admin/messaging/dispatches",
  ],
  domains: [],
  defaultEnabled: true,
};
