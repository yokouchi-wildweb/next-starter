// 生成物・編集不可: pnpm generate extensions が src/features/core/purchaseRequest/extensionPoints.ts から生成する
// completeHooks: src/features/core/purchaseRequest/services/server/hooks/definitions/<名前>.ts(x) か <名前>/index.ts(x) の export const hook(並びはファイル名の順)

import type { PurchaseCompleteHook } from "@/features/core/purchaseRequest/services/server/hooks/purchaseCompleteHookRegistry";

export const completeHooks: PurchaseCompleteHook[] = [];
