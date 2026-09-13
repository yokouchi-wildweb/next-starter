// src/features/core/userLoginEvent/constants/index.ts

/**
 * user_login_events.event_type で許容する値。
 *
 * - signup: ユーザー新規登録 / 再入会の成功時
 * - login: 既存ユーザーのログイン成功時
 * - logout: ユーザー操作による明示的なセッション終了 (logout / pause / withdraw)。
 *   Cookie の自然失効やブラウザ閉鎖は含まない (サーバーに到達しないため記録不能)。
 *   同一端末上の「A がセッションを終えた直後に B が開始した」列 (端末受け渡し) を
 *   sessionHandoff.ts で検出するための終端側イベント。
 *
 * 失敗イベントは audit_logs (auth.login.failed) 側で扱うため、本テーブルには
 * 成功イベントのみを蓄積する (IP 重複検索の主用途は "実際に運用されている
 * アカウント" の特定であるため)。
 *
 * 値の追加は PostgreSQL enum (user_login_event_type) への ADD VALUE になるため
 * db:push が必要。値の削除は enum 再作成を伴うので原則行わない。
 */
export const USER_LOGIN_EVENT_TYPES = ["signup", "login", "logout"] as const;
export type UserLoginEventType = (typeof USER_LOGIN_EVENT_TYPES)[number];

/**
 * セッション開始側のイベント種別 (sessionHandoff の受け側判定に使う)。
 * signup を含めるのは「A 退会 → 同端末で B 新規登録」を拾うため。
 */
export const SESSION_START_EVENT_TYPES = ["signup", "login"] as const satisfies readonly UserLoginEventType[];

/** セッション終了側のイベント種別 */
export const SESSION_END_EVENT_TYPES = ["logout"] as const satisfies readonly UserLoginEventType[];

/** sessionHandoff 検出の既定時間窓 (分) */
export const DEFAULT_SESSION_HANDOFF_WINDOW_MINUTES = 5;

/**
 * 既定の保持期間 (日)。
 * audit_logs と同じく行ごとに `retention_days` を持ち、日次 cron でプルーニングする。
 * 1 年程度あれば IP 重複検出のユースケースは十分カバーできるという判断。
 */
export const DEFAULT_LOGIN_EVENT_RETENTION_DAYS = 365;
