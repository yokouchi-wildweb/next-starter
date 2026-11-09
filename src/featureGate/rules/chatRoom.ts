// src/featureGate/rules/chatRoom.ts
// チャット(Firestore のドメインで Postgres の表は無い)。表が 0 でも features を書き、汎用 API /api/chatRoom の導出と
// フォルダの呼び手(依存の検査)を閉じる(L1.12)。管理画面 /admin/chat-rooms は adminChatRooms.ts だけが持つ(chatRoom に dependsOn)
// 切り替えの値は今は無い(常に開)。値は土台の後に chatRoom の config.ts で作る(D29)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [],
  features: [
    "core/chatRoom",
  ],
  enabled: () => true,
};
