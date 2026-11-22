// src/domains/core/rateLimit/plugs/routeFactoryRateLimit/ipRate.default.ts
//
// 点 routeFactoryRateLimit(API ルートの Factory のレート制限、ちょうど 1 つ、宣言 src/lib/routeFactory/extensionPoints.ts)に差す上流の既定。
// 常設の rateLimit が差す(D53)。呼び手は隣の 1 行スイッチ ./ipRate.ts(fork は差替点 rateLimitRouteFactoryRateLimit で ./ipRate.replace.ts に替える)。
// カテゴリの名前の型 RateLimitCategory は項目の型に残り、src/wiring/apiRoute.ts が生成された一覧の型から取り出す


import type { RateLimitCategory } from "../../config";
import { checkRateLimit } from "../../services/server/wrappers/rateLimitHelper";
import type { RouteRateLimitPlug } from "@/lib/routeFactory/points";

export const plug: RouteRateLimitPlug<RateLimitCategory> = { deps: { checkRateLimit } };
