// src/app/api/coupon/[id]/restore/route.ts
// 静的フォルダ・シャドーイング対策の mirror ルート（詳細: src/lib/routeFactory/domainRoutes.ts）

import { createDomainRestoreRouteFor } from "src/lib/routeFactory";

export const { POST } = createDomainRestoreRouteFor("coupon");
