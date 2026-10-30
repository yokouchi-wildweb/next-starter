// 生成物・編集不可: pnpm extensions:generate が src/features/core/user/extensionPoints.ts から生成する
// cleanupHandlers: src/features/core/user/cleanupHandlers/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const handler(並びはファイル名の順)

import type { UserCleanupItem } from "@/features/core/user/services/server/cleanup";

import { handler as purchaseRequest } from "@/features/core/user/cleanupHandlers/purchaseRequest";
import { handler as wallet } from "@/features/core/user/cleanupHandlers/wallet";

export const cleanupHandlers: UserCleanupItem[] = [
  purchaseRequest,
  wallet,
];
