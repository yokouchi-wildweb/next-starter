// src/app/api/[domain]/[id]/hard-delete/route.ts

import { NextResponse } from "next/server";

import { createDomainIdRoute } from "src/lib/routeFactory";

// DELETE /api/[domain]/[id]/hard-delete : 完全削除（物理削除）
export const DELETE = createDomainIdRoute(
  {
    operation: "DELETE /api/[domain]/[id]/hard-delete",
    operationType: "write",
    supports: "hardDelete",
  },
  async (_req, { service, params }) => {
    await service.hardDelete(params.id);
    return new NextResponse(null, { status: 204 });
  },
);
