// src/app/api/[domain]/[id]/reorder/route.ts

import { createDomainIdRoute } from "src/lib/routeFactory";

// POST /api/[domain]/[id]/reorder : 指定IDのレコードの並び順を変更
export const POST = createDomainIdRoute(
  {
    operation: "POST /api/[domain]/[id]/reorder",
    operationType: "write",
    supports: "reorder",
  },
  async (req, { service, params }) => {
    const body = await req.json();
    const afterItemId = body?.afterItemId ?? null;
    return service.reorder(params.id, afterItemId);
  },
);
