// トリガー名から該当する reward_key 一覧を取得

import { referralRewardRewardGroups } from "@/domains/core/referralReward/extensions/referralRewardRewardGroups";
import { gate } from "@/featureGate";

/**
 * トリガー名から該当する reward_key 一覧を取得(閉じたドメインの報酬グループは始めない: gate.plugs)
 */
export function getRewardKeysByTrigger(trigger: string): string[] {
  const keys: string[] = [];
  for (const { plug: group } of gate.plugs(referralRewardRewardGroups)) {
    for (const [rewardKey, def] of Object.entries(group.rewards)) {
      if (def.trigger === trigger) {
        keys.push(rewardKey);
      }
    }
  }
  return keys;
}
