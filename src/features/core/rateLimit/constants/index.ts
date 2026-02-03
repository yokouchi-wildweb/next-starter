// src/features/core/rateLimit/constants/index.ts

/**
 * レート制限チェック結果
 */
export type RateLimitResult = {
  /** リクエストが許可されたか */
  allowed: boolean;
  /** 残りリクエスト数 */
  remaining: number;
  /** ウィンドウリセット日時 */
  resetAt: Date;
  /** 現在のカウント */
  count: number;
};

/**
 * レート制限キー生成
 * @example buildRateLimitKey("signup", "192.168.1.1") => "signup:192.168.1.1"
 */
export function buildRateLimitKey(category: string, identifier: string): string {
  return `${category}:${identifier}`;
}
