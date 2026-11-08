// src/config/features/rateLimit.config.ts
// レート制限の設定の上書き(持ち主 src/features/core/rateLimit/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 上流のカテゴリの値を変える: `export default { login: { maxRequests: 10 } } satisfies RateLimitOverride<Extra>;`
// 自分のカテゴリを足す: 下の Extra に `<名前>: RateLimitRule` を足し、値を書く(route の rateLimit: "<名前>" で使える)
import type { RateLimitOverride, RateLimitRule } from "@/features/rateLimit/config";

export type Extra = Record<never, RateLimitRule>;

export default {} satisfies RateLimitOverride<Extra>;
