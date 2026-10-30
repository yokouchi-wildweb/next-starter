// 生成物・編集不可: pnpm extensions:generate が src/features/core/referralReward/extensionPoints.ts から生成する
// rewardGroups: src/features/core/referralReward/rewardGroups/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const group(並びはファイル名の順)

import type { ReferralRewardGroupItem } from "@/features/core/referralReward/types/rewardConfig";

const rewardGroupsList: ReferralRewardGroupItem[] = [];
export const rewardGroups: Readonly<Record<string, ReferralRewardGroupItem>> = Object.assign(Object.create(null), Object.fromEntries(rewardGroupsList.map((item) => [String(item.key), item])));
if (Object.keys(rewardGroups).length !== rewardGroupsList.length) throw new Error("rewardGroups: key が重複している項目がある");
