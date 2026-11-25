// src/domains/core/auth/constants/signupFailure.ts

/**
 * 登録まわりの失敗の記録(audit_logs)の流れと理由(metadata.flow / metadata.reason の値の集合)。loginFailure.ts と同じ置き方。
 *
 * 流れ(flow):
 * - email_link: メールリンクの送信(POST /api/auth/send-email-link)
 * - early_registration_link: 先行登録リンクの送信(POST /api/auth/send-early-registration-link)
 * - register: 本登録(POST /api/auth/register)
 * - password_reset: パスワード再設定のリンク(POST /api/auth/forgot-password。action は auth.passwordReset.failed)
 *
 * 理由(reason):
 * - invalid_email: メールアドレスが無い・文字列でない
 * - disposable_email: 使い捨てメール(黙った止め。利用者には成功を返す)
 * - hide_my_email_blocked: Hide My Email の止め(黙った止め。利用者には成功を返す)
 * - hide_my_email_challenge: Hide My Email で reCAPTCHA v2 の追加の認証を求めた(428)
 * - invalid_input: 本登録の入力が検査に通らない
 * - role_disabled: 求めたロールが使えない
 * - token_invalid: ID トークンの検証に失敗(失効・無効化を含む)
 * - provider_uid_missing: トークンから UID が取れない
 * - credential_mismatch: トークンの UID と送られた UID が違う
 * - email_mismatch: トークンのメールとフォームのメールが違う
 * - not_pre_registered: 仮登録が無い
 * - session_invalidated: 全セッション失効の境目より前の認証
 * - already_registered: すでに本登録済み(409)
 * - password_missing / password_set_failed: パスワードが無い / Firebase への設定に失敗
 * - user_not_found: パスワード再設定で該当のユーザーが無い(黙った止め)
 * - link_generation_failed / mail_send_failed: パスワード再設定のリンクの生成 / メールの送信に失敗
 *
 * 足す時は、集計の SQL・管理画面の表示も同じ commit で揃える。
 */
export const SIGNUP_FAILURE_FLOWS = ["email_link", "early_registration_link", "register", "password_reset"] as const;

export type SignupFailureFlow = (typeof SIGNUP_FAILURE_FLOWS)[number];

export const SIGNUP_FAILURE_REASONS = [
  "invalid_email",
  "disposable_email",
  "hide_my_email_blocked",
  "hide_my_email_challenge",
  "invalid_input",
  "role_disabled",
  "token_invalid",
  "provider_uid_missing",
  "credential_mismatch",
  "email_mismatch",
  "not_pre_registered",
  "session_invalidated",
  "already_registered",
  "password_missing",
  "password_set_failed",
  "user_not_found",
  "link_generation_failed",
  "mail_send_failed",
] as const;

export type SignupFailureReason = (typeof SIGNUP_FAILURE_REASONS)[number];
