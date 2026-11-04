// src/features/core/user/cleanupHandlers/purchaseRequest.ts
// 未処理の購入リクエスト（pending / processing）を expired にキャンセル

import { gate } from "@/featureGate";
import { cancelPending } from "@/features/core/purchaseRequest/services/server/cancelPending";

import type { UserCleanupItem } from "../services/server/cleanup";

export const handler: UserCleanupItem = {
  required: false,
  enabled: () => gate.enabled("payment"),
  run: cancelPending,
};
