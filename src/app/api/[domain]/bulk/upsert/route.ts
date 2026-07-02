// src/app/api/[domain]/bulk/upsert/route.ts

import { buildDomainRoute, bulkUpsertOperation } from "src/lib/routeFactory";

// POST /api/[domain]/bulk/upsert : 複数レコードの一括アップサート
export const POST = buildDomainRoute(bulkUpsertOperation);
