// src/app/api/referral/bulk/upsert/route.ts
// 静的フォルダ・シャドーイング対策の mirror ルート（詳細: src/lib/routeFactory/domainRoutes.ts）

import { createDomainBulkUpsertRouteFor } from "src/lib/routeFactory";

export const { POST } = createDomainBulkUpsertRouteFor("referral");
