// src/app/api/[domain]/bulk/delete-by-query/route.ts

import { buildDomainRoute, bulkDeleteByQueryOperation } from "src/lib/routeFactory";

// POST /api/[domain]/bulk/delete-by-query : クエリ条件で一括削除
export const POST = buildDomainRoute(bulkDeleteByQueryOperation);
