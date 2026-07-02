// src/app/api/notification/bulk/delete-by-ids/route.ts
// 静的フォルダ・シャドーイング対策の mirror ルート（詳細: src/lib/routeFactory/domainRoutes.ts）

import { createDomainBulkDeleteByIdsRouteFor } from "src/lib/routeFactory";

export const { POST } = createDomainBulkDeleteByIdsRouteFor("notification");
