// 紹介報酬の設定
//
// ベースリポジトリでは空の定義のみ。下流プロジェクトで報酬を追加する。
//
// 使い方（下流プロジェクト）:
// 1. このファイルに報酬グループ・定義を追加
// 2. services/server/handlers/ にハンドラーファイルを作成し registerRewardHandler() で登録
// 3. handlers/index.ts で副作用インポート（import "./myHandler"）
// 4. 任意のタイミングで triggerRewards(trigger, referral, context?, tx?) を呼ぶ

import type { ReferralRewardGroup } from "./types/rewardConfig";

/**
 * 報酬グループ定義マップ
 * key = グループキー（管理画面でのグルーピング単位）
 *
 * 下流プロジェクトで追加する例:
 * ```ts
 * export const REFERRAL_REWARD_DEFINITIONS: Record<string, ReferralRewardGroup> = {
 *   signup_bonus: {
 *     label: "登録完了ボーナス",
 *     rewards: {
 *       signup_inviter_bonus: {
 *         label: "招待者：登録完了ボーナス",
 *         trigger: "signup_completed",
 *         recipientRole: "inviter",
 *       },
 *       signup_invitee_welcome: {
 *         label: "被招待者：ウェルカムボーナス",
 *         trigger: "signup_completed",
 *         recipientRole: "invitee",
 *       },
 *     },
 *   },
 * };
 * ```
 */
export const REFERRAL_REWARD_DEFINITIONS: Record<string, ReferralRewardGroup> = {
  // 下流プロジェクトで定義を追加する
};
