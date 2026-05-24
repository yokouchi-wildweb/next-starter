// src/features/core/auth/constants/loginFailure.ts

/**
 * ログイン失敗理由 (audit_logs の metadata.reason に格納される値の集合)。
 *
 * - wrong_password: パスワード不一致 (既知ユーザー)
 * - user_not_found: 該当メールアドレスのユーザーが存在しない
 * - not_admin_role: 管理者ロール以外のユーザー
 * - status_pending: 仮登録状態
 * - status_withdrawn: 退会済み状態
 * - short_locked: 短期ロック中の試行 (locked_until 未到来)
 * - permanent_locked: 永続ロック中の試行 (status=security_locked)
 *
 * 追加する場合は、SQL 集計クエリ・admin UI ラベル側も同期して更新すること。
 */
export const LOGIN_FAILURE_REASONS = [
  "wrong_password",
  "user_not_found",
  "not_admin_role",
  "status_pending",
  "status_withdrawn",
  "short_locked",
  "permanent_locked",
] as const;

export type LoginFailureReason = (typeof LOGIN_FAILURE_REASONS)[number];
