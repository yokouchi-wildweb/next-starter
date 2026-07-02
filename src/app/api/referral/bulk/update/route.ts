// src/app/api/referral/bulk/update/route.ts
// 静的フォルダ・シャドーイング対策の mirror ルート（詳細: src/lib/routeFactory/domainRoutes.ts）

import { createDomainBulkUpdateRouteFor } from "src/lib/routeFactory";

export const { POST } = createDomainBulkUpdateRouteFor("referral");
