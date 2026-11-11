// src/features/core/messaging/services/server/history/index.ts
//
// 利用者ごとの履歴(本物の DB を結ぶ)。呼び手は messagingService.listUserMessageHistory(server だけ、route なし)

import { drizzleUserHistoryStore } from "./store";
import { listUserMessageHistory as listUserMessageHistoryWith, type UserMessageHistoryQuery } from "./userHistory";

/** 利用者の連絡の履歴(新しい順、keyset)。管理者は確かめない: 読める人は呼び手の route が決める */
export function listUserMessageHistory(userId: string, query?: UserMessageHistoryQuery) {
  return listUserMessageHistoryWith({ store: drizzleUserHistoryStore }, userId, query);
}

export { UserMessageHistoryQuerySchema } from "./userHistory";
export type { UserMessageHistoryPage, UserMessageHistoryQuery } from "./userHistory";
export type { UserMessageHistoryItem } from "./dto";
