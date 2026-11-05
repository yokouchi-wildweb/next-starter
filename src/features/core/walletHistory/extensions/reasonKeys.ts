// 生成物・編集不可: pnpm extensions:generate が src/features/core/walletHistory/extensionPoints.ts から生成する
// reasonKeys: src/features/core/walletHistory/reasonKeys/<名前>.ts(x) か <名前>/index.ts(x) の export const reasonKey(並びはファイル名の順)

import type { WalletReasonKeyItem } from "@/features/core/walletHistory/types/reasonKey";

import { reasonKey as reasonKeys_adminAdjustment } from "@/features/core/walletHistory/reasonKeys/adminAdjustment";
import { reasonKey as reasonKeys_couponAttributionReward } from "@/features/core/walletHistory/reasonKeys/couponAttributionReward";

const reasonKeysList: WalletReasonKeyItem[] = [
  reasonKeys_adminAdjustment,
  reasonKeys_couponAttributionReward,
];
export const reasonKeys: Readonly<Record<string, WalletReasonKeyItem>> = Object.assign(Object.create(null), Object.fromEntries(reasonKeysList.map((item) => [String(item.key), item])));
if (Object.keys(reasonKeys).length !== reasonKeysList.length) throw new Error("reasonKeys: key が重複している項目がある");
