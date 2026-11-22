// 生成物・編集不可: pnpm generate extensions が src/domains/core/wallet/extensionPoints.ts から生成する
// purchaseBonuses: src/domains/core/wallet/purchaseBonuses/<名前>.ts(x) か <名前>/index.ts(x) の export const provider(並びはファイル名の順)

import type { PurchaseBonusProvider } from "@/domains/core/wallet/types/purchaseBonus";

const purchaseBonusesList: PurchaseBonusProvider[] = [];
export const purchaseBonuses: Readonly<Record<string, PurchaseBonusProvider>> = Object.assign(Object.create(null), Object.fromEntries(purchaseBonusesList.map((item) => [String(item.key), item])));
if (Object.keys(purchaseBonuses).length !== purchaseBonusesList.length) throw new Error("purchaseBonuses: key が重複している項目がある");
