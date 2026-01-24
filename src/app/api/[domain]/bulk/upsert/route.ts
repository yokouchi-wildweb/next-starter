// src/app/api/[domain]/bulk/upsert/route.ts

import { createDomainRoute } from "src/lib/routeFactory";

type DomainParams = { domain: string };

// POST /api/[domain]/bulk/upsert : 複数レコードの一括アップサート
export const POST = createDomainRoute<any, DomainParams>(
  {
    operation: "POST /api/[domain]/bulk/upsert",
    operationType: "write",
    supports: "bulkUpsert",
  },
  async (req, { service }) => {
    const { records, options } = await req.json();
    const result = await service.bulkUpsert(records, options);
    return result;
  },
);
