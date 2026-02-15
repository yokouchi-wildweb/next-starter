// 報酬定義のルックアップユーティリティ

import { REFERRAL_REWARD_DEFINITIONS } from "../config";
import type { ReferralRewardDefinition } from "../types/rewardConfig";

/**
 * reward_key からフラットな定義を取得する
 */
export function getRewardDefinition(rewardKey: string): ReferralRewardDefinition | undefined {
  for (const group of Object.values(REFERRAL_REWARD_DEFINITIONS)) {
    if (rewardKey in group.rewards) {
      return group.rewards[rewardKey];
    }
  }
  return undefined;
}

/**
 * reward_key が属するグループキーを取得する
 */
export function getRewardGroupKey(rewardKey: string): string | undefined {
  for (const [groupKey, group] of Object.entries(REFERRAL_REWARD_DEFINITIONS)) {
    if (rewardKey in group.rewards) {
      return groupKey;
    }
  }
  return undefined;
}
