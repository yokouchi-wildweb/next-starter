// src/app/api/coupon/[id]/duplicate/route.ts
// 静的フォルダ・シャドーイング対策の mirror ルート（詳細: src/lib/routeFactory/domainRoutes.ts）

import { createDomainDuplicateRouteFor } from "src/lib/routeFactory";

export const { POST } = createDomainDuplicateRouteFor("coupon");
