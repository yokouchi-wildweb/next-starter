// 紹介報酬の設定
//
// ベースリポジトリでは空の定義のみ。下流プロジェクトで報酬を追加する。
//
// 使い方（下流プロジェクト）:
// 1. このファイルに報酬定義を追加
// 2. services/server/handlers/ にハンドラーファイルを作成し registerRewardHandler() で登録
// 3. 任意のタイミングで triggerRewards(trigger, referral, tx?) を呼ぶ

import type { ReferralRewardDefinition } from "./types/rewardConfig";

/**
 * 報酬定義マップ
 * key = reward_key（referral_rewards テーブルの reward_key に対応）
 *
 * 下流プロジェクトで追加する例:
 * ```ts
 * export const REFERRAL_REWARD_DEFINITIONS = {
 *   signup_inviter_bonus: {
 *     label: "招待者：登録完了ボーナス",
 *     trigger: "signup_completed",
 *     recipientRole: "inviter",
 *   },
 *   signup_invitee_welcome: {
 *     label: "被招待者：ウェルカムボーナス",
 *     trigger: "signup_completed",
 *     recipientRole: "invitee",
 *   },
 * } as const satisfies Record<string, ReferralRewardDefinition>;
 * ```
 */
export const REFERRAL_REWARD_DEFINITIONS: Record<string, ReferralRewardDefinition> = {
  // 下流プロジェクトで定義を追加する
};
