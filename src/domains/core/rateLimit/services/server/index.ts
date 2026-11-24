// src/domains/core/rateLimit/services/server/index.ts
// レート制限の公開の入口(server)。鍵・規則・重みで数える consumeRateLimit / 読むだけの peekRateLimit と、
// カテゴリで数える今の checkRateLimit / getRateLimitStatus(その上に乗る)。README: ../../README.md

export { consumeRateLimit, peekRateLimit } from "./rateLimit";
export { checkRateLimit, cleanupExpiredRateLimits, getRateLimitStatus } from "./wrappers/rateLimitHelper";
export type { ConsumeRateLimitInput, RateLimitKey, RateLimitWindowRule } from "./consume";
export type { RateLimitResult } from "../../constants";
