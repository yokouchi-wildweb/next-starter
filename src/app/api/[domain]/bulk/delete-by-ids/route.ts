// src/app/api/[domain]/bulk/delete-by-ids/route.ts

import { buildDomainRoute, bulkDeleteByIdsOperation } from "src/lib/routeFactory";

// POST /api/[domain]/bulk/delete-by-ids : ID指定の複数削除
export const POST = buildDomainRoute(bulkDeleteByIdsOperation);
