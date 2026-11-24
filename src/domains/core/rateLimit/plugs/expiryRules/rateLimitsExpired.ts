// src/domains/core/rateLimit/plugs/expiryRules/rateLimitsExpired.ts
// 増設点 expiryRules の項目: 回数の数え(rate_limits、identifier が IP・利用者を持つ)を期限(expires_at)が過ぎたら消す。個人情報の削除(D59)
// 消す行: expires_at < 今(固定の窓 = 窓の終わり、滑る窓 = bucket の始まり + 窓)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "rate_limits",
  key: "id",
  rule: { kind: "expiresAt", column: "expires_at" },
  pii: true,
};
