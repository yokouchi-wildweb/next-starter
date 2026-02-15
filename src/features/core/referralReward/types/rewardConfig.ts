// 報酬定義の型

/**
 * 報酬受取者の役割
 */
export type RecipientRole = "inviter" | "invitee";

/**
 * 個別の報酬定義
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
 * 報酬グループ定義
 * 同一シナリオの inviter/invitee 報酬をまとめる単位
 */
export type ReferralRewardGroup = {
  /** 管理画面での表示名（例: "初回購入ボーナス（300コイン）"） */
  label: string;
  /** グループに属する報酬定義（key = reward_key） */
  rewards: Record<string, ReferralRewardDefinition>;
};
