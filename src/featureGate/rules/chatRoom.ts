// src/featureGate/rules/chatRoom.ts
// チャット(Firestore のドメインで Postgres の表は無い)。表が 0 でも domains を書き、汎用 API /api/chatRoom の導出と
// フォルダの呼び手(依存の検査)を閉じる(L1.12)。管理画面 /admin/chat-rooms もこの規則の住所(子のスイッチは持たない、設定 D104)
// 入切の既定は開(defaultEnabled: true)。fork が閉じる値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/chat-rooms",
  ],
  domains: [
    "core/chatRoom",
  ],
  defaultEnabled: false,
};
