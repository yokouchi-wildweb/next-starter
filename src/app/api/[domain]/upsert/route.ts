// src/app/api/[domain]/upsert/route.ts

import { createDomainRoute } from "src/lib/routeFactory";

type DomainParams = { domain: string };

// PUT /api/[domain]/upsert : 既存データを更新、なければ新規作成
export const PUT = createDomainRoute<any, DomainParams>(
  {
    operation: "PUT /api/[domain]/upsert",
    operationType: "write",
    supports: "upsert",
  },
  async (req, { service }) => {
    const { data, options } = await req.json();
    return service.upsert(data, options);
  },
);
