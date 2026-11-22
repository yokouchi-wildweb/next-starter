// src/domains/core/user/cleanupHandlers/messagingPreferences.ts
// 退会で本人の連絡の好み(カテゴリー × 送信チャンネルの配信停止の行)を消す。個人の設定なので失敗したら退会ごと戻す(required、D38)

import { deletePreferencesOfUser } from "@/domains/core/messaging/services/server";

import type { UserCleanupItem } from "@/domains/core/user/services/server/cleanup";

export const handler: UserCleanupItem = {
  required: true,
  run: deletePreferencesOfUser,
};
