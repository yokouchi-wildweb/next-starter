// src/domains/core/user/cleanupHandlers/messagingEndpoints.ts
// 退会で本人の端末の帳簿(プッシュのトークン・電話番号など)を消す。個人の情報なので失敗したら退会ごと戻す(required)

import { deleteEndpointsOfUser } from "@/domains/core/messaging/services/server";

import type { UserCleanupItem } from "@/domains/core/user/services/server/cleanup";

export const handler: UserCleanupItem = {
  required: true,
  run: deleteEndpointsOfUser,
};
