// src/features/core/user/cleanupHandlers/messagingPreferences.ts
// 退会で本人の連絡の好み(種類 × 経路の配信停止の行)を消す。個人の設定なので失敗したら退会ごと戻す(required、D38)

import { deletePreferencesOfUser } from "@/features/core/messaging/services/server";

import type { UserCleanupItem } from "../services/server/cleanup";

export const handler: UserCleanupItem = {
  required: true,
  run: deletePreferencesOfUser,
};
