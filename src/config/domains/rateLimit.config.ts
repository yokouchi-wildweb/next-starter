// src/config/domains/rateLimit.config.ts
// レート制限の設定の上書き(持ち主 src/domains/core/rateLimit/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 上流のカテゴリの値を変える: `export default { login: { maxRequests: 10 } } satisfies RateLimitOverride<Extra>;`
// 自分のカテゴリを足す: 下の Extra に `<名前>: RateLimitRule` を足し、値を書く(route の rateLimit: "<名前>" で使える)
import type { RateLimitOverride, RateLimitRule } from "@/domains/rateLimit/config";

export type Extra = Record<never, RateLimitRule>;

export default {} satisfies RateLimitOverride<Extra>;
