// src/app/api/coupon/[id]/hard-delete/route.ts
// 静的フォルダ・シャドーイング対策の mirror ルート（詳細: src/lib/routeFactory/domainRoutes.ts）

import { createDomainHardDeleteRouteFor } from "src/lib/routeFactory";

export const { DELETE } = createDomainHardDeleteRouteFor("coupon");
