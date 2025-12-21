// src/app/api/[domain]/bulk/delete-by-ids/route.ts

import { createDomainRoute } from "src/lib/routeFactory";

type DomainParams = { domain: string };

// POST /api/[domain]/bulk/delete-by-ids : ID指定の複数削除
export const POST = createDomainRoute<any, DomainParams>(
  {
    operation: "POST /api/[domain]/bulk/delete-by-ids",
    operationType: "write",
    supports: "bulkDeleteByIds",
  },
  async (req, { service }) => {
    const { ids } = await req.json();
    await service.bulkDeleteByIds(ids);
    return { success: true };
  },
);
