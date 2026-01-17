/**
 * OAuth認証フロー用のユーティリティ関数
 */

import { log } from "@/utils/log";
import type { StorageClient } from "@/lib/browserStorage";

export const REDIRECT_ATTEMPT_STORAGE_KEY = "auth.oauth.redirectAttempted";

/**
 * SessionStorageからリダイレクト試行フラグをクリア
 */
export function clearRedirectAttempt(
  sessionStorage: StorageClient,
  provider?: string,
): void {
  if (!sessionStorage.exists(REDIRECT_ATTEMPT_STORAGE_KEY)) {
    return;
  }

  sessionStorage.remove(REDIRECT_ATTEMPT_STORAGE_KEY);
  log(3, "[OAuth] redirect attempt flag removed", { provider });
}

/**
 * SessionStorageにリダイレクト試行フラグを設定
 */
export function markRedirectAttempted(
  sessionStorage: StorageClient,
  provider?: string,
): void {
  sessionStorage.save(REDIRECT_ATTEMPT_STORAGE_KEY, "1");
  log(3, "[OAuth] redirect attempt flag saved", { provider });
}

/**
 * リダイレクト試行フラグが存在するかチェック
 */
export function hasRedirectAttempt(sessionStorage: StorageClient): boolean {
  return sessionStorage.exists(REDIRECT_ATTEMPT_STORAGE_KEY);
}
