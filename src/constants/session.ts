// src/constants/session.ts

/**
 * JWT セッション Cookie の既定名。
 * プロジェクト全体で統一的に利用する。
 */
// Firebase Hosting/App Hosting では `__session` 以外の Cookie 名が破棄されるため、
// セッション維持用 Cookie の名称も `__session` に合わせる。
export const SESSION_COOKIE_NAME = "__session" as const;

/**
 * セッショントークンの標準的な最大存続時間（秒）。
 * 7 日間をデフォルト値として採用する。
 */
export const SESSION_DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
