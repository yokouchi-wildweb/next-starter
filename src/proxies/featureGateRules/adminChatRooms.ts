// src/proxies/featureGateRules/adminChatRooms.ts
// チャットルームの管理画面(汎用 CRUD /api/chatRoom は利用者側も使うので止めない)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: ["/admin/chat-rooms"],
  enabled: () => APP_FEATURES.adminConsole.enableChatRoomAdmin,
};
