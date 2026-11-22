// 生成物・編集不可: pnpm generate extensions が src/domains/core/walletHistory/extensionPoints.ts から生成する
// reasonKeys: src/domains/core/walletHistory/reasonKeys/<名前>.ts(x) か <名前>/index.ts(x) の export const reasonKey(並びはファイル名の順)

import type { WalletReasonKeyItem } from "@/domains/core/walletHistory/types/reasonKey";

import { reasonKey as reasonKeys_adminAdjustment } from "@/domains/core/walletHistory/reasonKeys/adminAdjustment";
import { reasonKey as reasonKeys_compensation } from "@/domains/core/walletHistory/reasonKeys/compensation";
import { reasonKey as reasonKeys_couponAttributionReward } from "@/domains/core/walletHistory/reasonKeys/couponAttributionReward";

const reasonKeysList: WalletReasonKeyItem[] = [
  reasonKeys_adminAdjustment,
  reasonKeys_compensation,
  reasonKeys_couponAttributionReward,
];
export const reasonKeys: Readonly<Record<string, WalletReasonKeyItem>> = Object.assign(Object.create(null), Object.fromEntries(reasonKeysList.map((item) => [String(item.key), item])));
if (Object.keys(reasonKeys).length !== reasonKeysList.length) throw new Error("reasonKeys: key が重複している項目がある");
