import type { GuardFailReason } from "./types";

/** sessionStorageに保存するキー */
export const TRANSITION_TOKEN_STORAGE_KEY = "transition:token";

/** デフォルトのトークン有効期限（5分） */
export const DEFAULT_TOKEN_TTL_MS = 5 * 60 * 1000;

/** ガード失敗時のデフォルトメッセージ */
export const GUARD_FAIL_MESSAGES: Record<GuardFailReason, string> = {
  no_token: "不正なアクセス: 遷移トークンがありません",
  expired: "不正なアクセス: 遷移トークンの有効期限が切れています",
  path_mismatch: "不正なアクセス: 遷移先パスが一致しません",
  key_mismatch: "不正なアクセス: トークンキーが一致しません",
  invalid_referer: "不正なアクセス: 許可されていない遷移元です",
};
