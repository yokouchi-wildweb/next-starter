// トリガー名から該当する reward_key 一覧を取得

import { REFERRAL_REWARD_DEFINITIONS } from "../../../config";

/**
 * トリガー名から該当する reward_key 一覧を取得
 */
export function getRewardKeysByTrigger(trigger: string): string[] {
  const keys: string[] = [];
  for (const group of Object.values(REFERRAL_REWARD_DEFINITIONS)) {
    for (const [rewardKey, def] of Object.entries(group.rewards)) {
      if (def.trigger === trigger) {
        keys.push(rewardKey);
      }
    }
  }
  return keys;
}
