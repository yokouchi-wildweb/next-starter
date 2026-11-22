// 生成物・編集不可: pnpm generate extensions が src/domains/core/purchaseRequest/extensionPoints.ts から生成する
// purchaseRequestCompleteHooks: 差す側の <ドメイン>/plugs/purchaseRequestCompleteHooks/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const hook(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { PurchaseCompleteHook } from "@/domains/core/purchaseRequest/services/server/hooks/purchaseCompleteHookRegistry";

export const purchaseRequestCompleteHooks: { domain: string | null; name: string; requires: readonly string[]; plug: PurchaseCompleteHook }[] = [];
