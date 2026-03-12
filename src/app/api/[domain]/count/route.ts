// src/app/api/[domain]/count/route.ts

import { createDomainRoute } from "src/lib/routeFactory";
import type { CountParams } from "@/lib/crud/types";

type DomainParams = { domain: string };

// POST /api/[domain]/count : フィルタ条件に一致するレコード件数を取得
export const POST = createDomainRoute<any, DomainParams>(
  {
    operation: "POST /api/[domain]/count",
    operationType: "read",
    supports: "count",
  },
  async (req, { service }) => {
    const body = await req.json();
    const countParams: CountParams = {};

    if (body.where) countParams.where = body.where;
    if (body.searchQuery) countParams.searchQuery = body.searchQuery;
    if (body.searchFields) countParams.searchFields = body.searchFields;
    if (body.relationWhere) countParams.relationWhere = body.relationWhere;

    return service.count(countParams);
  },
);
