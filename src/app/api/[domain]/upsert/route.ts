// src/app/api/[domain]/upsert/route.ts

import { buildDomainRoute, upsertOperation } from "src/lib/routeFactory";

// PUT /api/[domain]/upsert : 既存データを更新、なければ新規作成
export const PUT = buildDomainRoute(upsertOperation);
