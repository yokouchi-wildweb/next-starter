// 生成物・編集不可: pnpm generate extensions が src/domains/core/referralReward/extensionPoints.ts から生成する
// referralRewardRewardGroups: 差す側の <ドメイン>/plugs/referralRewardRewardGroups/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const group(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { ReferralRewardGroupItem } from "@/domains/core/referralReward/types/rewardConfig";

export const referralRewardRewardGroups: { domain: string | null; name: string; requires: readonly string[]; plug: ReferralRewardGroupItem }[] = [];
