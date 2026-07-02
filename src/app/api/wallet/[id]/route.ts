// src/app/api/wallet/[id]/route.ts
// 静的フォルダ・シャドーイング対策の mirror ルート（詳細: src/lib/routeFactory/domainRoutes.ts）

import { createDomainIdRouteFor } from "src/lib/routeFactory";

export const { GET, PUT, DELETE } = createDomainIdRouteFor("wallet");
