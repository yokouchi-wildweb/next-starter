// src/app/api/[domain]/search-for-sorting/route.ts

import { createDomainRoute } from "@/wiring/apiRoute";
import { resolveSearchLimit } from "@/lib/crud";
import type { BoundedSearchParams, SearchParams } from "@/lib/crud";

type DomainParams = { domain: string };

// POST /api/[domain]/search-for-sorting : ソート画面用検索（NULL の sort_order を自動初期化）
export const POST = createDomainRoute<any, DomainParams>(
  {
    operation: "POST /api/[domain]/search-for-sorting",
    crudOp: "searchForSorting",
    operationType: "write", // 副作用（NULL初期化）があるため write
    supports: "searchForSorting",
  },
  async (req, { service }) => {
    const body = await req.json();
    const requested: SearchParams = body ?? {};
    // limit は既定 100・上限 1000(超えれば 400)。server の search は limit 必須
    const searchParams: BoundedSearchParams = { ...requested, limit: resolveSearchLimit(requested.limit) };
    return service.searchForSorting(searchParams);
  },
);
