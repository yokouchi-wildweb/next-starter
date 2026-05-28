// src/features/core/userLoginEvent/constants/index.ts

/**
 * user_login_events.event_type で許容する値。
 *
 * - signup: ユーザー新規登録 / 再入会の成功時
 * - login: 既存ユーザーのログイン成功時
 *
 * 失敗イベントは audit_logs (auth.login.failed) 側で扱うため、本テーブルには
 * 成功イベントのみを蓄積する (IP 重複検索の主用途は "実際に運用されている
 * アカウント" の特定であるため)。
 */
export const USER_LOGIN_EVENT_TYPES = ["signup", "login"] as const;
export type UserLoginEventType = (typeof USER_LOGIN_EVENT_TYPES)[number];

/**
 * 既定の保持期間 (日)。
 * audit_logs と同じく行ごとに `retention_days` を持ち、日次 cron でプルーニングする。
 * 1 年程度あれば IP 重複検出のユースケースは十分カバーできるという判断。
 */
export const DEFAULT_LOGIN_EVENT_RETENTION_DAYS = 365;
