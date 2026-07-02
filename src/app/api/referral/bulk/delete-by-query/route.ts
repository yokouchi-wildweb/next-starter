// src/app/api/referral/bulk/delete-by-query/route.ts
// 静的フォルダ・シャドーイング対策の mirror ルート（詳細: src/lib/routeFactory/domainRoutes.ts）

import { createDomainBulkDeleteByQueryRouteFor } from "src/lib/routeFactory";

export const { POST } = createDomainBulkDeleteByQueryRouteFor("referral");
