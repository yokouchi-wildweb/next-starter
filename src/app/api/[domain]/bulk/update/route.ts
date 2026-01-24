// src/app/api/[domain]/bulk/update/route.ts

import { createDomainRoute } from "src/lib/routeFactory";

type DomainParams = { domain: string };

// POST /api/[domain]/bulk/update : 複数レコードの一括更新
export const POST = createDomainRoute<any, DomainParams>(
  {
    operation: "POST /api/[domain]/bulk/update",
    operationType: "write",
    supports: "bulkUpdate",
  },
  async (req, { service }) => {
    const { records } = await req.json();
    const result = await service.bulkUpdate(records);
    return result;
  },
);
