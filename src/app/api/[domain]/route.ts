// src/app/api/[domain]/route.ts

import { createDomainRoute } from "src/lib/routeFactory";

type DomainParams = { domain: string };

// GET /api/[domain] : 指定ドメインの一覧を取得
export const GET = createDomainRoute<any, DomainParams>(
  {
    operation: "GET /api/[domain]",
    operationType: "read",
  },
  async (_req, { service }) => {
    return service.list();
  },
);

// POST /api/[domain] : 指定ドメインの新規データを作成
export const POST = createDomainRoute<any, DomainParams>(
  {
    operation: "POST /api/[domain]",
    operationType: "write",
  },
  async (req, { service }) => {
    const { data } = await req.json();
    return service.create(data);
  },
);
