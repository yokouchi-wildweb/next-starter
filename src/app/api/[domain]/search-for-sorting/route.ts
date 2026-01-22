// src/app/api/[domain]/search-for-sorting/route.ts

import { createDomainRoute } from "src/lib/routeFactory";
import type { SearchParams } from "@/lib/crud";

type DomainParams = { domain: string };

// POST /api/[domain]/search-for-sorting : ソート画面用検索（NULL の sort_order を自動初期化）
export const POST = createDomainRoute<any, DomainParams>(
  {
    operation: "POST /api/[domain]/search-for-sorting",
    operationType: "write", // 副作用（NULL初期化）があるため write
    supports: "searchForSorting",
  },
  async (req, { service }) => {
    const body = await req.json();
    const searchParams: SearchParams = body ?? {};
    return service.searchForSorting(searchParams);
  },
);
