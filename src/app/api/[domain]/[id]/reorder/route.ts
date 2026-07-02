// src/app/api/[domain]/[id]/reorder/route.ts

import { buildDomainIdRoute, reorderOperation } from "src/lib/routeFactory";

// POST /api/[domain]/[id]/reorder : 指定IDのレコードの並び順を変更
export const POST = buildDomainIdRoute(reorderOperation);
