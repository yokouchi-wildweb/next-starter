// src/app/api/[domain]/[id]/restore/route.ts

import { createDomainIdRoute } from "src/lib/routeFactory";

// POST /api/[domain]/[id]/restore : ソフトデリートしたデータを復旧
export const POST = createDomainIdRoute(
  {
    operation: "POST /api/[domain]/[id]/restore",
    operationType: "write",
    supports: "restore",
  },
  async (_req, { service, params }) => {
    return service.restore(params.id);
  },
);
