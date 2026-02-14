// トリガーベースの報酬一括実行

import type { Referral } from "@/features/core/referral/entities/model";
import { getRewardKeysByTrigger } from "./getRewardKeysByTrigger";
import { fulfillReward, type FulfillResult } from "./fulfillReward";
import type { TransactionClient } from "@/lib/drizzle/transaction";

/**
 * トリガー実行結果
 */
export type TriggerRewardsResult = {
  trigger: string;
  results: { rewardKey: string; result: FulfillResult }[];
};

/**
 * トリガー名に紐づく報酬を一括で配布する
 *
 * config の REFERRAL_REWARD_DEFINITIONS から該当トリガーの reward_key を検索し、
 * 各報酬に対して fulfillReward() を実行する。
 *
 * 下流プロジェクトでの使い方:
 * ```ts
 * // サインアップ完了時
 * await triggerRewards("signup_completed", referral, tx);
 *
 * // 初回購入時
 * await triggerRewards("first_purchase", referral, tx);
 * ```
 *
 * @param trigger トリガー識別子
 * @param referral 紹介レコード
 * @param tx トランザクション（オプション）
 */
export async function triggerRewards(
  trigger: string,
  referral: Referral,
  tx?: TransactionClient,
): Promise<TriggerRewardsResult> {
  const rewardKeys = getRewardKeysByTrigger(trigger);

  const results: TriggerRewardsResult["results"] = [];

  for (const rewardKey of rewardKeys) {
    const result = await fulfillReward(rewardKey, referral, tx);
    results.push({ rewardKey, result });
  }

  return { trigger, results };
}
