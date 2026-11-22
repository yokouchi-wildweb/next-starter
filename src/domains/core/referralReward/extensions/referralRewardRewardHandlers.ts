// 生成物・編集不可: pnpm generate extensions が src/domains/core/referralReward/extensionPoints.ts から生成する
// referralRewardRewardHandlers: 差す側の <ドメイン>/plugs/referralRewardRewardHandlers/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const handler(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { RewardHandlerItem } from "@/domains/core/referralReward/services/server/rewardHandlerRegistry";

export const referralRewardRewardHandlers: { domain: string | null; name: string; requires: readonly string[]; plug: RewardHandlerItem }[] = [];
