// 報酬ハンドラーレジストリ
//
// 下流プロジェクトが報酬の実行ロジックを登録するためのレジストリ。
// ベースリポジトリではレジストリ機構のみ提供し、ハンドラーは登録しない。
//
// 使い方（下流プロジェクト）:
// ```ts
// import { registerRewardHandler } from "@/features/core/referralReward/services/server/rewardHandlerRegistry";
//
// registerRewardHandler("signup_inviter_bonus", async (referral, tx) => {
//   const result = await walletService.adjustBalance({...}, tx);
//   return { walletHistoryId: result.history.id, amount: 100 };
// });
// ```

import type { Referral } from "@/features/core/referral/entities/model";
import type { TransactionClient } from "@/lib/drizzle/transaction";

/**
 * 報酬ハンドラーの型
 *
 * @param referral 紹介レコード
 * @param tx トランザクション（オプション）
 * @returns metadata として referralReward に保存されるオブジェクト
 */
export type RewardHandler = (
  referral: Referral,
  tx?: TransactionClient,
) => Promise<Record<string, unknown>>;

/** ハンドラーの内部ストア */
const handlers = new Map<string, RewardHandler>();

/**
 * 報酬ハンドラーを登録する
 *
 * @param rewardKey 報酬キー（REFERRAL_REWARD_DEFINITIONS のキーと一致させること）
 * @param handler 実行関数
 */
export function registerRewardHandler(rewardKey: string, handler: RewardHandler): void {
  handlers.set(rewardKey, handler);
}

/**
 * 登録済みの報酬ハンドラーを取得する
 *
 * @param rewardKey 報酬キー
 * @returns ハンドラー関数、未登録の場合は undefined
 */
export function getRewardHandler(rewardKey: string): RewardHandler | undefined {
  return handlers.get(rewardKey);
}

/**
 * 指定した報酬キーのハンドラーが登録されているか確認する
 */
export function hasRewardHandler(rewardKey: string): boolean {
  return handlers.has(rewardKey);
}
