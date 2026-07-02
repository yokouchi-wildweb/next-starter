// src/app/api/[domain]/search/route.ts

import { buildDomainRoute, searchOperation } from "src/lib/routeFactory";

// GET /api/[domain]/search : ドメインデータを検索
export const GET = buildDomainRoute(searchOperation);
