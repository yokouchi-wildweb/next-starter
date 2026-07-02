// src/app/api/coupon/upsert/route.ts
// 静的フォルダ・シャドーイング対策の mirror ルート（詳細: src/lib/routeFactory/domainRoutes.ts）

import { createDomainUpsertRouteFor } from "src/lib/routeFactory";

export const { PUT } = createDomainUpsertRouteFor("coupon");
