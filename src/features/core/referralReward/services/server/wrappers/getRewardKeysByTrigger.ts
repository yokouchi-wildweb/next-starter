// トリガー名から該当する reward_key 一覧を取得

import { REFERRAL_REWARD_DEFINITIONS } from "../../../config";

/**
 * トリガー名から該当する reward_key 一覧を取得
 */
export function getRewardKeysByTrigger(trigger: string): string[] {
  return Object.entries(REFERRAL_REWARD_DEFINITIONS)
    .filter(([, def]) => def.trigger === trigger)
    .map(([key]) => key);
}
