// src/features/core/rateLimit/services/server/apiRouteRateLimitDeps.ts
//
// API ルートの Factory（lib/routeFactory）に差し込むレート制限の束。結ぶのは src/wiring/apiRoute.ts。

import type { RouteRateLimitDeps } from "@/lib/routeFactory";

import type { RateLimitCategory } from "../../config";

import { checkRateLimit } from "./wrappers/rateLimitHelper";

export const apiRouteRateLimitDeps: RouteRateLimitDeps<RateLimitCategory> = { checkRateLimit };
