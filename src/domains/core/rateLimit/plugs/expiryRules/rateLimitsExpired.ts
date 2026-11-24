// src/domains/core/rateLimit/plugs/expiryRules/rateLimitsExpired.ts
// 増設点 expiryRules の項目: 回数の数え(rate_limits、identifier が IP・利用者を持つ)を期限(expires_at)が過ぎたら消す。個人情報の削除(D59)
// 今の消し方 cleanupExpiredRateLimits(services/server/wrappers/rateLimitHelper.ts、呼び手 0)と同じ行を消す(その関数は区切り expiry-retire-crons まで残る)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "rate_limits",
  key: "id",
  rule: { kind: "expiresAt", column: "expires_at" },
  pii: true,
};
