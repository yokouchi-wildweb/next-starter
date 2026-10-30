// 生成物・編集不可: pnpm extensions:generate が src/features/core/referralReward/extensionPoints.ts から生成する
// rewardHandlers: src/features/core/referralReward/services/server/handlers/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const handler(並びはファイル名の順)

import type { RewardHandlerItem } from "@/features/core/referralReward/services/server/rewardHandlerRegistry";

export const rewardHandlers: RewardHandlerItem[] = [];
