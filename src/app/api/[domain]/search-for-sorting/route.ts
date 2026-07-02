// src/app/api/[domain]/search-for-sorting/route.ts

import { buildDomainRoute, searchForSortingOperation } from "src/lib/routeFactory";

// POST /api/[domain]/search-for-sorting : ソート画面用検索（NULL の sort_order を自動初期化）
export const POST = buildDomainRoute(searchForSortingOperation);
