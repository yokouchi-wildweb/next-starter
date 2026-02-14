// src/app/api/[domain]/bulk/update-by-ids/route.ts

import { createDomainRoute } from "src/lib/routeFactory";

type DomainParams = { domain: string };

// POST /api/[domain]/bulk/update-by-ids : ID指定の複数レコード一括更新（同一データ）
export const POST = createDomainRoute<any, DomainParams>(
  {
    operation: "POST /api/[domain]/bulk/update-by-ids",
    operationType: "write",
    supports: "bulkUpdateByIds",
  },
  async (req, { service }) => {
    const { ids, data } = await req.json();
    const result = await service.bulkUpdateByIds(ids, data);
    return result;
  },
);
