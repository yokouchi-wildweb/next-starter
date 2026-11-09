// src/featureGate/rules/adminChatRooms.ts
// チャットルームの管理画面(汎用 CRUD /api/chatRoom は利用者側も使うので止めない)。チャット(chatRoom)が閉なら一緒に閉じる

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["chatRoom"],
  pathPatterns: ["/admin/chat-rooms"],
  enabled: () => APP_FEATURES.adminConsole.enableChatRoomAdmin,
};
