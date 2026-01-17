import { consumeToken } from "./storage";
import type { GuardResult, TransitionGuardConfig } from "./types";

/**
 * 遷移ガードの検証を行う
 * トークンの検証と消費を同時に行う
 */
export function validateGuard(
  currentPath: string,
  config: TransitionGuardConfig
): GuardResult {
  // Refererチェック（補助的、トークンと併用）
  if (config.allowedReferers?.length) {
    const referer = typeof document !== "undefined" ? document.referrer : "";
    if (referer) {
      try {
        const refererPath = new URL(referer).pathname;
        const isAllowedReferer = config.allowedReferers.includes(refererPath);
        // Refererが不正でもトークンがあれば通過させる（トークン検証で判断）
        // トークン不要の場合のみRefererで判断
        if (config.requireToken === false && !isAllowedReferer) {
          return { passed: false, reason: "invalid_referer" };
        }
      } catch {
        // URL解析失敗は無視（トークン検証に委ねる）
      }
    }
  }

  // トークン検証
  if (config.requireToken !== false) {
    const token = consumeToken(); // 取得と同時に消費

    if (!token) {
      return { passed: false, reason: "no_token" };
    }

    if (token.expiresAt < Date.now()) {
      return { passed: false, reason: "expired" };
    }

    if (token.targetPath !== currentPath) {
      return { passed: false, reason: "path_mismatch" };
    }

    if (config.tokenKey && token.key !== config.tokenKey) {
      return { passed: false, reason: "key_mismatch" };
    }
  }

  return { passed: true };
}
