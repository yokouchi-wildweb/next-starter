// src/app/api/[domain]/[id]/duplicate/route.ts

import { createDomainIdRoute } from "src/lib/routeFactory";

// POST /api/[domain]/[id]/duplicate : 指定IDのデータを複製
export const POST = createDomainIdRoute(
  {
    operation: "POST /api/[domain]/[id]/duplicate",
    operationType: "write",
    supports: "duplicate",
  },
  async (_req, { service, params }) => {
    return service.duplicate(params.id);
  },
);
