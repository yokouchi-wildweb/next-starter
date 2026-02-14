// src/config/app/referral.config.ts
//
// 紹介報酬の設定
// ベースリポジトリでは空の定義のみ。下流プロジェクトで報酬を追加する。
//
// 使い方（下流プロジェクト）:
// 1. このファイルの REFERRAL_REWARD_DEFINITIONS に報酬を追加
// 2. handlers/registry.ts で registerRewardHandler() を呼んでハンドラーを登録
// 3. 任意のタイミングで triggerRewards(trigger, referral, tx?) を呼ぶ

/**
 * 報酬受取者の役割
 */
export type RecipientRole = "inviter" | "invitee";

/**
 * 報酬定義
 */
export type ReferralRewardDefinition = {
  /** 表示名 */
  label: string;
  /** トリガー識別子（例: "signup_completed", "first_purchase"） */
  trigger: string;
  /** 報酬の受取者 */
  recipientRole: RecipientRole;
};

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

/**
 * トリガー名から該当する reward_key 一覧を取得
 */
export function getRewardKeysByTrigger(trigger: string): string[] {
  return Object.entries(REFERRAL_REWARD_DEFINITIONS)
    .filter(([, def]) => def.trigger === trigger)
    .map(([key]) => key);
}
