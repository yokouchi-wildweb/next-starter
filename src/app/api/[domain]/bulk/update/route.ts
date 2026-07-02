// src/app/api/[domain]/bulk/update/route.ts

import { buildDomainRoute, bulkUpdateOperation } from "src/lib/routeFactory";

// POST /api/[domain]/bulk/update : 複数レコードの一括更新
export const POST = buildDomainRoute(bulkUpdateOperation);
