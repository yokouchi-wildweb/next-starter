// 報酬ハンドラーの型と読み手(項目: ./handlers/<名前>[.<fork の名前>].ts の export const handler、一覧は生成物)
// ベースリポジトリの項目は 0。
//
// 使い方（下流プロジェクト）: handlers/signupInviterBonus.<fork の名前>.ts
// ```ts
// export const handler: RewardHandlerItem = {
//   rewardKey: "signup_inviter_bonus",
//   handler: async ({ referral, recipientUserId, context, tx }) => {
//     const result = await walletService.adjustBalance({ userId: recipientUserId, amount: 100 }, tx);
//     return { walletHistoryId: result.history.id, amount: 100 };
//   },
// };
// ```

import { rewardHandlers } from "@/features/core/referralReward/extensions/rewardHandlers";
import type { Referral } from "@/features/core/referral/entities/model";
import type { TransactionClient } from "@/lib/drizzle/transaction";

/**
 * 報酬ハンドラーに渡されるパラメータ
 */
export type RewardHandlerParams = {
  /** 紹介レコード */
  referral: Referral;
  /** 報酬キー（自身がどのキーで呼ばれたかを知るため） */
  rewardKey: string;
  /** 受取人ユーザーID（fulfillReward が recipientRole から算出済み） */
  recipientUserId: string;
  /** トリガーイベントのコンテキスト情報（購入金額など） */
  context?: Record<string, unknown>;
  /** トランザクション */
  tx?: TransactionClient;
};

/**
 * 報酬ハンドラーの型
 *
 * @returns metadata として referralReward に保存されるオブジェクト
 */
export type RewardHandler = (
  params: RewardHandlerParams,
) => Promise<Record<string, unknown>>;

/** 報酬ハンドラーの項目(./handlers/<名前>[.<fork の名前>].ts の export const handler) */
export type RewardHandlerItem = {
  /** 報酬キー（REFERRAL_REWARD_DEFINITIONS のキーと一致させること） */
  rewardKey: string;
  handler: RewardHandler;
};

let memo: Map<string, RewardHandler> | null = null;

// 同じキーは後の項目(ファイル名の順)が勝つ。読み込みの途中で一覧を触らないよう初回に組み立てる
function handlers(): Map<string, RewardHandler> {
  memo ??= new Map(rewardHandlers.map((item) => [item.rewardKey, item.handler]));
  return memo;
}

/**
 * 報酬ハンドラーを取得する
 *
 * @param rewardKey 報酬キー
 * @returns ハンドラー関数、無い場合は undefined
 */
export function getRewardHandler(rewardKey: string): RewardHandler | undefined {
  return handlers().get(rewardKey);
}

/**
 * 指定した報酬キーのハンドラーがあるか確認する
 */
export function hasRewardHandler(rewardKey: string): boolean {
  return handlers().has(rewardKey);
}
