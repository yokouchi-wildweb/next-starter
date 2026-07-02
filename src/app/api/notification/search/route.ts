// src/app/api/notification/search/route.ts
// 静的フォルダ・シャドーイング対策の mirror ルート（詳細: src/lib/routeFactory/domainRoutes.ts）

import { createDomainSearchRouteFor } from "src/lib/routeFactory";

export const { GET } = createDomainSearchRouteFor("notification");
