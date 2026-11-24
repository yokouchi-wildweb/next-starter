// src/domains/core/rateLimit/services/server/rateLimit.ts
// consume / peek の本物の束(表 = drizzle、カテゴリ = 合成済みの config)。公開の入口は ./index.ts

import { RATE_LIMIT_CONFIG } from "../../config";
import { createRateLimit } from "./consume";
import { drizzleRateLimitStore } from "./store";

export const { consumeRateLimit, peekRateLimit } = createRateLimit({ store: drizzleRateLimitStore, categories: RATE_LIMIT_CONFIG });
