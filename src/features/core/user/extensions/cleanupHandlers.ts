// 生成物・編集不可: pnpm generate extensions が src/features/core/user/extensionPoints.ts から生成する
// cleanupHandlers: src/features/core/user/cleanupHandlers/<名前>.ts(x) か <名前>/index.ts(x) の export const handler(並びはファイル名の順)

import type { UserCleanupItem } from "@/features/core/user/services/server/cleanup";

import { handler as cleanupHandlers_messagingEndpoints } from "@/features/core/user/cleanupHandlers/messagingEndpoints";
import { handler as cleanupHandlers_purchaseRequest } from "@/features/core/user/cleanupHandlers/purchaseRequest";
import { handler as cleanupHandlers_wallet } from "@/features/core/user/cleanupHandlers/wallet";

export const cleanupHandlers: UserCleanupItem[] = [
  cleanupHandlers_messagingEndpoints,
  cleanupHandlers_purchaseRequest,
  cleanupHandlers_wallet,
];
