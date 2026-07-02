// src/app/api/[domain]/bulk/update-by-ids/route.ts

import { buildDomainRoute, bulkUpdateByIdsOperation } from "src/lib/routeFactory";

// POST /api/[domain]/bulk/update-by-ids : ID指定の複数レコード一括更新（同一データ）
export const POST = buildDomainRoute(bulkUpdateByIdsOperation);
