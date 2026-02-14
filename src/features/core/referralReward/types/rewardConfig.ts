// 報酬定義の型

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
