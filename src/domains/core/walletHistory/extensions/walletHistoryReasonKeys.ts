// 生成物・編集不可: pnpm generate extensions が src/domains/core/walletHistory/extensionPoints.ts から生成する
// walletHistoryReasonKeys: 差す側の <ドメイン>/plugs/walletHistoryReasonKeys/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const reasonKey(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { WalletReasonKeyItem } from "@/domains/core/walletHistory/types/reasonKey";

import { reasonKey as walletHistoryReasonKeys_couponAttributionReward_couponAttributionReward } from "@/domains/core/couponAttributionReward/plugs/walletHistoryReasonKeys/couponAttributionReward";
import { reasonKey as walletHistoryReasonKeys_walletHistory_adminAdjustment } from "@/domains/core/walletHistory/plugs/walletHistoryReasonKeys/adminAdjustment";
import { reasonKey as walletHistoryReasonKeys_walletHistory_compensation } from "@/domains/core/walletHistory/plugs/walletHistoryReasonKeys/compensation";

export const walletHistoryReasonKeys: { domain: string | null; name: string; requires: readonly string[]; plug: WalletReasonKeyItem }[] = [
  { domain: "couponAttributionReward", name: "couponAttributionReward", requires: ["wallet"], plug: walletHistoryReasonKeys_couponAttributionReward_couponAttributionReward },
  { domain: "walletHistory", name: "adminAdjustment", requires: [], plug: walletHistoryReasonKeys_walletHistory_adminAdjustment },
  { domain: "walletHistory", name: "compensation", requires: [], plug: walletHistoryReasonKeys_walletHistory_compensation },
];
